import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { PLATFORM_FEE_PERCENT, PROCESSOR_FEE_PERCENT } from '@/utils/fees'

export async function POST(req: Request) {
    try {
        const { email, amount, currency, reservationId, callbackUrl } = await req.json()

        if (!email || !amount || !reservationId || !callbackUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY
        if (!secretKey) {
            console.error('PAYSTACK_SECRET_KEY missing')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Fetch subaccount code
        const supabase = await createClient()

        // Join reservations -> events -> organizers
        const { data: reservation, error: resError } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select(`
                quantity,
                addons,
                event_id,
                ticket_tiers ( price ),
                discounts ( type, value ),
                events (
                    fee_bearer,
                    platform_fee_percent,
                    organizers (
                        paystack_subaccount_code,
                        platform_fee_percent
                    )
                )
            `)
            .eq('id', reservationId)
            .single()

        let subaccountCode = null
        let transactionCharge = 0
        let addonRevenue = 0

        if (reservation) {
            const event = Array.isArray((reservation as any).events) ? (reservation as any).events[0] : (reservation as any).events
            const organizer = event ? (Array.isArray(event.organizers) ? event.organizers[0] : event.organizers) : null

            if (organizer) {
                subaccountCode = organizer.paystack_subaccount_code
            }

            // Calculate Addons Revenue (to be separated/kept by platform or routed via flat fee)
            const addons = (reservation as any).addons
            if (addons && Object.keys(addons).length > 0) {
                const { data: addonDetails } = await supabase
                    .schema('gatepass')
                    .from('event_addons')
                    .select('id, price')
                    .eq('event_id', reservation.event_id)
                    .in('id', Object.keys(addons))

                if (addonDetails) {
                    addonRevenue = addonDetails.reduce((sum, item) => {
                        const qty = addons[item.id] || 0
                        return sum + (item.price * qty)
                    }, 0)
                }
            }

            // Convert Addon Revenue to Kobo/Pesewas immediately
            const addonRevenueSubunits = Math.round(addonRevenue * 100)

            // Calculate Split
            if (subaccountCode) {
                const ticketTier = Array.isArray((reservation as any).ticket_tiers) ? (reservation as any).ticket_tiers[0] : (reservation as any).ticket_tiers
                let price = Number(ticketTier?.price) || 0

                // Platform Fee Rate
                let platformRate = PLATFORM_FEE_PERCENT // Default 0.04

                // Determine Rate
                let rawPercent = (event?.platform_fee_percent as number)
                    ?? (organizer?.platform_fee_percent as number)
                    ?? 0;

                if (rawPercent > 0) {
                    // Check if stored as decimal (e.g. 0.04 for 4%) instead of integer (4 for 4%)
                    // If less than 1, assume it's decimal representation and convert to percent integer
                    if (rawPercent < 1.0) {
                        rawPercent = rawPercent * 100
                    }
                    platformRate = rawPercent / 100
                }

                // Fallback if price missing (critical for calculations)
                if (price === 0) {
                    console.warn('Paystack Initialize: Price not found in DB, using transaction amount as fallback base')
                    // Amount is in kobo/pesewas. Price is in GHS.
                    // Assume Amount ~= Price + Fees. 
                    // Amount = Price + (Price * PlatformRate) + (Price * ProcessorRate) [Roughly]
                    // Price = (Amount/100) / (1 + PlatformRate + ProcessorRate)
                    price = (amount / 100) / (1 + platformRate + PROCESSOR_FEE_PERCENT)
                }

                const quantity = reservation.quantity || 1

                // Discount
                let discountAmount = 0
                const discount = Array.isArray(reservation.discounts) ? reservation.discounts[0] : reservation.discounts
                if (discount) {
                    if (discount.type === 'percentage') {
                        discountAmount = (price * quantity) * (discount.value / 100)
                    } else {
                        discountAmount = discount.value
                    }
                }

                // Effective Base for Platform Fee
                // We calculate PLATFORM fee on the TICKET REVENUE ONLY.
                // We calculate PROCESSOR fee on the TOTAL REVENUE (Tickets + Addons).

                const ticketRevenue = Math.max(0, (price * quantity) - discountAmount)

                // Platform Fee = Ticket Revenue * Rate
                // (Add-ons are exempt from Platform Fee)
                const platformFee = ticketRevenue * platformRate

                // Convert to Kobo/Pesewas for Subaccount Split
                // Transaction Charge = Platform Fee.
                // Paystack takes their fee (Processor Fee) from the total amount automatically.
                // The Bearer = 'subaccount' means the Subaccount (Organizer) pays the Paystack fee from their share, 
                // UNLESS we adjust the total price to include it (which we do if feeBearer=customer).
                // But specifically here, `transaction_charge` dictates what overrides the default split.
                // If we set transaction_charge, Paystack gives (Amount - PaystackFee - TransactionCharge) to Subaccount.
                // And (TransactionCharge) to Main Account.

                transactionCharge = Math.round(platformFee * 100)

                // Sanity Check: Ensure we don't take more than the total amount?
                if (transactionCharge > amount) {
                    console.error('Transaction charge exceeds total amount!', { transactionCharge, amount })
                    transactionCharge = 0 // Safety fallback
                }

                const totalRevenue = ticketRevenue + addonRevenue

                console.log('Paystack Split Logic:', {
                    reservationId,
                    dbPrice: ticketTier?.price,
                    usedPrice: price,
                    quantity,
                    totalRevenue,
                    ticketRevenue,
                    platformRate,
                    addonRevenue,
                    transactionCharge, // in kobo
                    amount // in kobo
                })
            }
        }

        const payload: any = {
            email,
            amount, // in kobo/pesewas
            currency,
            reference: reservationId, // Use reservationId as reference for easy tracking
            callback_url: callbackUrl,
            metadata: {
                reservationId,
                custom_fields: [
                    {
                        display_name: "Reservation ID",
                        variable_name: "reservation_id",
                        value: reservationId
                    }
                ]
            }
        }

        // Add subaccount if available
        if (subaccountCode) {
            payload.subaccount = subaccountCode
            payload.transaction_charge = transactionCharge
            payload.bearer = 'subaccount'
        }

        // Initialize transaction with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (!response.ok || !data.status) {
            console.error('Paystack Initialize Error:', data)
            return NextResponse.json({ error: data.message || 'Failed to initialize payment' }, { status: 400 })
        }

        return NextResponse.json(data.data) // Contains authorization_url, access_code, etc.

    } catch (error: any) {
        console.error('Initialization Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
