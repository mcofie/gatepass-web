import { NextResponse } from 'next/server'
import { createInstalmentReservation } from '@/utils/actions/instalment'
import { confirmPayment, PaymentProviderError } from '@/lib/payments'

/**
 * POST /api/payments/verify-instalment
 * Verifies the first instalment payment and creates the instalment reservation + schedule.
 */
export async function POST(request: Request) {
    try {
        const { reference, reservationId, paymentPlanId } = await request.json()

        if (!reference || !reservationId || !paymentPlanId) {
            return NextResponse.json(
                { error: 'Missing required fields: reference, reservationId, paymentPlanId' },
                { status: 400 }
            )
        }

        const confirmation = await confirmPayment(reference)
        if (confirmation.status !== 'success') {
            return NextResponse.json({ error: confirmation.message }, { status: 400 })
        }
        const metadata = confirmation.session.metadata as { payment_type?: string; payment_plan_id?: string }
        if (metadata.payment_type !== 'instalment_first' || !confirmation.session.reservation_ids.includes(reservationId)) {
            return NextResponse.json({ error: 'This payment does not belong to that reservation' }, { status: 400 })
        }

        // The plan recorded at checkout wins over the query string
        const result = await createInstalmentReservation(reference, reservationId, metadata.payment_plan_id ?? paymentPlanId, confirmation.transaction)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('[verify-instalment] Error:', error)
        const message = error instanceof Error ? error.message : 'Verification failed'
        return NextResponse.json({ error: message }, { status: error instanceof PaymentProviderError ? 400 : 500 })
    }
}
