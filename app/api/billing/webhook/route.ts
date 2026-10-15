import { NextRequest, NextResponse } from 'next/server'
import { confirmPlatformFeePayment, isPlatformFeeReference, parseGatepassWebhook } from '@/lib/billing'
import { getSession } from '@/lib/payments'
import { fulfilConfirmedSession } from '@/lib/payments/fulfil'
import { notifyDiscord } from '@/utils/discord'

/**
 * Paystack webhook for GatePass's own account. Two kinds of payment land here:
 * platform fees (gpfee… references) and ticket sales through GatePass Payments.
 */
export async function POST(req: NextRequest) {
    const rawBody = await req.text()
    try {
        const reference = await parseGatepassWebhook(req.headers, rawBody)
        if (!reference) return NextResponse.json({ ok: true, ignored: true })

        if (isPlatformFeeReference(reference)) {
            const result = await confirmPlatformFeePayment(reference)
            if (result.status === 'paid') {
                await notifyDiscord(`💼 **Platform fee paid**\n**Event:** ${result.eventId}\n**Ref:** ${reference}`, 'success')
            }
            return NextResponse.json({ ok: true })
        }

        const session = await getSession(reference)
        if (!session || session.provider !== 'gatepass') return NextResponse.json({ ok: true, ignored: true })
        const result = await fulfilConfirmedSession(reference)
        return NextResponse.json({ ok: true, status: result.status })
    } catch (error) {
        console.error('[billing/webhook]', error)
        // Non-2xx so Paystack retries
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
