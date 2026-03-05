import { NextResponse } from 'next/server'
import { createInstalmentReservation } from '@/utils/actions/instalment'
import { verifyPaystackTransaction } from '@/lib/paystack'

/**
 * POST /api/paystack/verify-instalment
 * Verifies the first instalment payment and creates the instalment reservation + schedule.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { reference, reservationId, paymentPlanId } = body

        if (!reference || !reservationId || !paymentPlanId) {
            return NextResponse.json(
                { error: 'Missing required fields: reference, reservationId, paymentPlanId' },
                { status: 400 }
            )
        }

        // Verify with Paystack first
        const transaction = await verifyPaystackTransaction(reference)

        if (transaction.status !== 'success') {
            return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
        }

        // Create the instalment reservation
        const result = await createInstalmentReservation(
            reference,
            reservationId,
            paymentPlanId,
            transaction
        )

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[verify-instalment] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
