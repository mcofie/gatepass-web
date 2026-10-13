import { NextResponse } from 'next/server'
import { processInstalmentPayment, processFullInstalmentPayment } from '@/utils/actions/instalment'
import { confirmPayment, PaymentProviderError } from '@/lib/payments'

/**
 * POST /api/payments/pay-instalment
 * Processes a subsequent instalment payment.
 * If this is the final payment, tickets are created and issued.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { reference, instalmentPaymentId, instalmentReservationId, isFullPayment } = body

        if (!reference || (!instalmentPaymentId && !instalmentReservationId)) {
            return NextResponse.json(
                { error: 'Missing required fields: reference and either instalmentPaymentId or instalmentReservationId' },
                { status: 400 }
            )
        }

        const confirmation = await confirmPayment(reference)
        if (confirmation.status !== 'success') {
            return NextResponse.json({ error: confirmation.message }, { status: 400 })
        }

        // Trust the ids recorded when the checkout started, not the query string
        const metadata = confirmation.session.metadata as { payment_type?: string; instalment_payment_id?: string; instalment_reservation_id?: string; is_full_payment?: boolean }
        if (metadata.payment_type !== 'instalment') {
            return NextResponse.json({ error: 'This is not an instalment payment' }, { status: 400 })
        }
        const result = (isFullPayment || body.fullSettlement || metadata.is_full_payment)
            ? await processFullInstalmentPayment(reference, metadata.instalment_reservation_id ?? instalmentReservationId, confirmation.transaction)
            : await processInstalmentPayment(reference, metadata.instalment_payment_id ?? instalmentPaymentId, confirmation.transaction)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('[pay-instalment] Error:', error)
        const message = error instanceof Error ? error.message : 'Payment failed'
        return NextResponse.json({ error: message }, { status: error instanceof PaymentProviderError ? 400 : 500 })
    }
}
