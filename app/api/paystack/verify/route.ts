import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { reference, reservationId } = await request.json()


        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!serviceRoleKey) {
            console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.')
            return NextResponse.json({ error: 'Server Configuration Error: Missing Service Role Key' }, { status: 500 })
        }

        // Use Admin Client to bypass RLS for Ticket Generation
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey
        )

        // 1. Verify Request Data
        if (!reference || !reservationId) {
            return NextResponse.json({ error: 'Missing reference or reservationId' }, { status: 400 })
        }

        // 2. Verify with Paystack
        const transaction = await verifyPaystackTransaction(reference)

        if (transaction.status !== 'success') {
            return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
        }

        // 3. Fetch Reservation details to ensure valid Context
        const { data: reservation, error: resError } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select('*, ticket_tiers(*)')
            .eq('id', reservationId)
            .single()

        if (resError || !reservation) {
            console.error('Reservation Fetch Error:', resError)
            return NextResponse.json({
                error: `Reservation not found. ID: ${reservationId}. DB Error: ${resError?.message || 'None'}`
            }, { status: 404 })
        }

        // 4. Idempotency Check: Check if ticket already exists for this reference
        const { data: existingTicket } = await supabase
            .schema('gatepass')
            .from('tickets')
            .select('id')
            .eq('order_reference', reference)
            .single()

        if (existingTicket) {
            return NextResponse.json({ success: true, message: 'Ticket already exists' })
        }

        // 5. Create Ticket
        const { error: ticketError } = await supabase
            .schema('gatepass')
            .from('tickets')
            .insert({
                user_id: reservation.user_id,
                event_id: reservation.event_id,
                tier_id: reservation.ticket_tiers.id,
                reservation_id: reservation.id,
                qr_code_hash: Math.random().toString(36).substring(7), // Simple placeholder hash
                order_reference: reference,
                status: 'valid'
            })

        if (ticketError) {
            console.error('Ticket Creation Error:', ticketError)
            return NextResponse.json({ error: 'Failed to generate ticket' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Verification Handler Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
