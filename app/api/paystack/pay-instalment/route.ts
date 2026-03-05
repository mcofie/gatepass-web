import { NextResponse } from 'next/server'
import { processInstalmentPayment } from '@/utils/actions/instalment'
import { verifyPaystackTransaction } from '@/lib/paystack'

/**
 * POST /api/paystack/pay-instalment
 * Processes a subsequent instalment payment.
 * If this is the final payment, tickets are created and issued.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { reference, instalmentPaymentId } = body

        if (!reference || !instalmentPaymentId) {
            return NextResponse.json(
                { error: 'Missing required fields: reference, instalmentPaymentId' },
                { status: 400 }
            )
        }

        // Verify with Paystack
        const transaction = await verifyPaystackTransaction(reference)

        if (transaction.status !== 'success') {
            return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
        }

        // Process the instalment
        const result = await processInstalmentPayment(reference, instalmentPaymentId, transaction)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[pay-instalment] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
