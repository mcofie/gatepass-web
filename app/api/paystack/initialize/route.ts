import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
                events (
                    organizers (
                        paystack_subaccount_code
                    )
                )
            `)
            .eq('id', reservationId)
            .single()

        let subaccountCode = null
        if (reservation) {
            const event = Array.isArray((reservation as any).events) ? (reservation as any).events[0] : (reservation as any).events
            const organizer = event ? (Array.isArray(event.organizers) ? event.organizers[0] : event.organizers) : null

            if (organizer) {
                subaccountCode = organizer.paystack_subaccount_code
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
            // payload.transaction_charge // Optional: Flat fee to platform?
            // payload.bearer = 'subaccount' // Who pays fees? Default is usually subaccount or both shared.
            // For now, simple split.
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
