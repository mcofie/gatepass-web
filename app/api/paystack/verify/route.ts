import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { NextResponse } from 'next/server'
import { processSuccessfulPayment } from '@/utils/actions/payment'

export async function POST(request: Request) {
    try {
        if (request.method !== 'POST') {
            return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
        }

        let body;
        try {
            // Check for empty body possibility
            const text = await request.text()
            if (!text) {
                return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
            }
            body = JSON.parse(text)
        } catch (e) {
            console.error('Verify Route: JSON Parse Error', e)
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { reference, reservationId, reservationIds, addons } = body


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
        if (!reference || (!reservationId && (!reservationIds || reservationIds.length === 0))) {
            console.error(`Verification missing data. Ref: ${reference}, ResID: ${reservationId}`)
            return NextResponse.json({ error: `Missing data. Reference: ${reference}, ReservationId: ${reservationId}` }, { status: 400 })
        }

        // 2. Verify with Paystack
        const transaction = await verifyPaystackTransaction(reference)

        if (transaction.status !== 'success') {
            return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
        }

        // 3. Determine IDs to Process (Prefer Paystack Metadata as Source of Truth)
        let idsToProcess = reservationIds || (reservationId ? [reservationId] : [])

        // Try extracting from Paystack Metadata (handles scenarios where client context is lost/partial)
        // Try extracting from Paystack Metadata
        let metaIds = transaction.metadata?.reservation_ids

        // Handle case where Paystack returns it as a string
        if (typeof metaIds === 'string') {
            metaIds = metaIds.split(',').map((s: string) => s.trim())
        }

        // Fallback: Check custom_fields
        if ((!metaIds || !Array.isArray(metaIds)) && transaction.metadata?.custom_fields) {
            const field = transaction.metadata.custom_fields.find((f: any) => f.variable_name === 'reservation_ids')
            if (field && field.value) {
                metaIds = field.value.split(',').map((s: string) => s.trim())
            }
        }

        if (Array.isArray(metaIds) && metaIds.length > 0) {
            idsToProcess = metaIds
        }

        if (idsToProcess.length === 0) {
            return NextResponse.json({ error: 'No reservation IDs found in transaction' }, { status: 400 })
        }

        console.log(`[Verify] Processing IDs: ${idsToProcess.length}`, idsToProcess)

        // 4. Process Payment
        const result = await processSuccessfulPayment(reference, idsToProcess, transaction, addons)

        // Sanitize Return Data (Remove circular references or heavy nested objects)
        if (result.tickets) {
            result.tickets = result.tickets.map((t: any) => {
                // Remove 'reservations' prop which contains circular refs to event/organizer
                const { reservations, ...rest } = t
                return rest
            })
        }

        return NextResponse.json(result)

        // Force Link Metadata if missing (for legacy or edge cases)
        // processSuccessfulPayment normally does this, but being explicit helps? 
        // No, processSuccessfulPayment handles DB logic.

    } catch (error: unknown) {
        console.error('Verification Handler Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown payment verification error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
