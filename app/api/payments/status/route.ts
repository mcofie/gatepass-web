import { NextResponse } from 'next/server'
import { confirmPayment, PaymentProviderError } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/** Polled by /pay/[reference] while a buyer approves a push payment (M-Pesa) on their phone. */
export async function GET(req: Request) {
    const reference = new URL(req.url).searchParams.get('reference')
    if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    try {
        const confirmation = await confirmPayment(reference)
        return NextResponse.json({
            status: confirmation.status,
            message: confirmation.status === 'success' ? null : confirmation.message,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Status check failed'
        return NextResponse.json({ status: 'error', message }, { status: error instanceof PaymentProviderError ? 400 : 500 })
    }
}
