import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { PLATFORM_FEE_PERCENT, PROCESSOR_FEE_PERCENT } from '@/utils/fees'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, amount, currency, callbackUrl } = body
        // Support both single and multiple IDs
        const reservationIds = Array.isArray(body.reservationIds)
            ? body.reservationIds
            : (body.reservationId ? [body.reservationId] : [])

        if (!email || !amount || reservationIds.length === 0 || !callbackUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY
        if (!secretKey) {
            console.error('PAYSTACK_SECRET_KEY missing')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Fetch all reservations
        const supabase = await createClient()

        const { data: reservations, error: resError } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select(`
                id,
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
            .in('id', reservationIds)

        if (resError || !reservations || reservations.length === 0) {
            return NextResponse.json({ error: 'Reservations not found' }, { status: 404 })
        }

        let subaccountCode: string | null = null
        let totalTransactionCharge = 0
        let totalAddonRevenue = 0

        // Iterate to aggregate fees and revenue
        for (const reservation of reservations) {
            const event = Array.isArray((reservation as any).events) ? (reservation as any).events[0] : (reservation as any).events
            const organizer = event ? (Array.isArray(event.organizers) ? event.organizers[0] : event.organizers) : null

            // Set Subaccount (from first valid organizer)
            if (!subaccountCode && organizer?.paystack_subaccount_code) {
                subaccountCode = organizer.paystack_subaccount_code
            }

            // 1. Calculate Addons Revenue
            const addons = (reservation as any).addons
            if (addons && Object.keys(addons).length > 0) {
                const { data: addonDetails } = await supabase
                    .schema('gatepass')
                    .from('event_addons')
                    .select('id, price')
                    .eq('event_id', reservation.event_id)
                    .in('id', Object.keys(addons))

                if (addonDetails) {
                    const resAddonRevenue = addonDetails.reduce((sum, item) => {
                        const qty = addons[item.id] || 0
                        return sum + (item.price * qty)
                    }, 0)
                    totalAddonRevenue += resAddonRevenue
                }
            }

            // 2. Calculate Platform Fee for this Reservation
            if (subaccountCode) { // Only relevant if splitting
                const ticketTier = Array.isArray((reservation as any).ticket_tiers) ? (reservation as any).ticket_tiers[0] : (reservation as any).ticket_tiers
                let price = Number(ticketTier?.price) || 0

                // Rate Logic
                let platformRate = PLATFORM_FEE_PERCENT
                let rawPercent = (event?.platform_fee_percent as number)
                    ?? (organizer?.platform_fee_percent as number)
                    ?? 0;

                if (rawPercent > 0) {
                    if (rawPercent < 1.0) rawPercent = rawPercent * 100
                    platformRate = rawPercent / 100
                }

                if (price === 0) {
                    // Fallback: If price 0/missing, we can't easily reverse-calc for just one item in a batch.
                    // We skip fee calc for this specific broken item or assume 0 fee.
                    console.warn(`Price missing for reservation ${reservation.id}, skipping fee calc`)
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

                const ticketRevenue = Math.max(0, (price * quantity) - discountAmount)
                const platformFee = ticketRevenue * platformRate

                totalTransactionCharge += Math.round(platformFee * 100)
            }
        }

        // Sanity Check
        if (totalTransactionCharge > amount) {
            console.error('Total charges exceed amount', { totalTransactionCharge, amount })
            totalTransactionCharge = 0
        }

        const payload: any = {
            email,
            amount, // in kobo/pesewas
            currency,
            reference: reservationIds[0], // Use PRIMARY reservation ID as Paystack reference (simplifies webhook lookup)
            callback_url: callbackUrl,
            metadata: {
                reservation_ids: reservationIds, // Store ALL IDs
                custom_fields: [
                    {
                        display_name: "Reservation IDs",
                        variable_name: "reservation_ids",
                        value: reservationIds.join(', ')
                    }
                ]
            }
        }

        // Add subaccount if available
        if (subaccountCode) {
            payload.subaccount = subaccountCode
            payload.transaction_charge = totalTransactionCharge
            payload.bearer = 'subaccount'
        }

        console.log(`[Paystack Init] Amount: ${amount}, Charge: ${totalTransactionCharge} (ids: ${reservationIds.length})`)

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

        return NextResponse.json(data.data)

    } catch (error: any) {
        console.error('Initialization Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
