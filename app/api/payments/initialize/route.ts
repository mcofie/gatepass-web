import { NextResponse } from 'next/server'
import { startCheckout, PaymentProviderError } from '@/lib/payments'
import { notifyDiscord } from '@/utils/discord'

/** Buyers may only be sent back to GatePass itself after paying. */
function isAllowedReturnUrl(req: Request, returnUrl: string) {
    try {
        const target = new URL(returnUrl).origin
        const allowed = [new URL(req.url).origin, req.headers.get('origin'), process.env.NEXT_PUBLIC_SITE_URL && new URL(process.env.NEXT_PUBLIC_SITE_URL).origin]
        return allowed.includes(target)
    } catch {
        return false
    }
}

/**
 * Starts a checkout with the event organizer's own payment provider.
 * Returns the URL to send the buyer to.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const reservationIds: string[] = Array.isArray(body.reservationIds)
            ? body.reservationIds
            : (body.reservationId ? [body.reservationId] : [])
        const { email, amount, currency, callbackUrl, phone, metadata } = body

        if (!email || !amount || reservationIds.length === 0 || !callbackUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
        if (!isAllowedReturnUrl(req, callbackUrl)) {
            return NextResponse.json({ error: 'Invalid callback URL' }, { status: 400 })
        }

        const checkout = await startCheckout({
            reservationIds,
            email,
            phone,
            amountMinor: Math.round(Number(amount)),
            currency: currency || 'GHS',
            returnUrl: callbackUrl,
            metadata: metadata && typeof metadata === 'object' ? metadata : {},
        })

        await notifyDiscord(
            `🛒 **Checkout Started**\n` +
            `**Email:** ${email}\n` +
            `**Amount:** ${currency} ${(Number(amount) / 100).toLocaleString()}\n` +
            `**Provider:** ${checkout.provider}\n` +
            `**Ref:** ${checkout.reference}`,
            'info'
        )

        return NextResponse.json({
            authorization_url: checkout.redirectUrl,
            reference: checkout.reference,
            gateway: checkout.provider,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Payment initialization failed'
        console.error('[payments/initialize]', error)
        return NextResponse.json({ error: message }, { status: error instanceof PaymentProviderError ? 400 : 500 })
    }
}
