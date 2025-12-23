import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { NextResponse } from 'next/server'
import { processSuccessfulPayment } from '@/utils/actions/payment'

export async function POST(request: Request) {
    try {
        const { reference, reservationId, addons } = await request.json()


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
            console.error(`Verification missing data. Ref: ${reference}, ResID: ${reservationId}`)
            return NextResponse.json({ error: `Missing data. Reference: ${reference}, ReservationId: ${reservationId}` }, { status: 400 })
        }

        // 2. Verify with Paystack
        const transaction = await verifyPaystackTransaction(reference)

        if (transaction.status !== 'success') {
            return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
        }

        // 3. Process Payment (Shared Logic)
        const result = await processSuccessfulPayment(reference, reservationId, transaction, addons)

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Processing failed' }, { status: 500 })
        }

        return NextResponse.json({ success: true, tickets: result.tickets })

    } catch (error: unknown) {
        console.error('Verification Handler Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown payment verification error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
