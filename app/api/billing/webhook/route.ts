import { NextRequest, NextResponse } from 'next/server'
import { confirmPlatformFeePayment, parsePlatformFeeWebhook } from '@/lib/billing'
import { notifyDiscord } from '@/utils/discord'

/**
 * Paystack webhook for GatePass's own account. Only platform fee payments go through it now;
 * ticket payments go to each organizer's own provider and their own webhook URL.
 */
export async function POST(req: NextRequest) {
    const rawBody = await req.text()
    try {
        const reference = await parsePlatformFeeWebhook(req.headers, rawBody)
        if (!reference) return NextResponse.json({ ok: true, ignored: true })

        const result = await confirmPlatformFeePayment(reference)
        if (result.status === 'paid') {
            await notifyDiscord(`💼 **Platform fee paid**\n**Event:** ${result.eventId}\n**Ref:** ${reference}`, 'success')
        }
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[billing/webhook]', error)
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
