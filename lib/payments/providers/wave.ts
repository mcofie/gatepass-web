import { createHmac, timingSafeEqual } from 'crypto'
import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'

const API = 'https://api.wave.com/v1'

export const wave: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${API}/checkout/sessions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Wave currencies (XOF, UGX, GMD) take whole amounts as strings
                amount: String(Math.round(toMajor(input.amountMinor))),
                currency: input.currency,
                client_reference: input.reference,
                success_url: input.returnUrl,
                error_url: input.returnUrl,
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.wave_launch_url) throw new PaymentProviderError(data.message || 'Wave could not start this payment')
        return { redirectUrl: data.wave_launch_url, providerReference: data.id }
    },

    async fetchTransaction(integration, session) {
        if (!session.providerReference) throw new PaymentProviderError('Missing Wave session id')
        const response = await fetch(`${API}/checkout/sessions/${encodeURIComponent(session.providerReference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.api_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok) throw new PaymentProviderError(data.message || 'Wave could not find this payment')
        return {
            status: data.payment_status === 'succeeded' ? 'success' : data.checkout_status === 'expired' || data.payment_status === 'cancelled' ? 'failed' : 'pending',
            reference: session.reference,
            amount: toMinor(data.amount),
            currency: data.currency,
            channel: 'wave',
            paid_at: data.when_completed ?? null,
            provider: 'wave',
            provider_reference: data.transaction_id ?? data.id,
            customer: { email: null },
            metadata: {},
        }
    },

    async parseWebhook(integration, { headers, rawBody }) {
        const secret = integration.credentials.webhook_secret
        if (secret) {
            // Wave-Signature: t=<timestamp>,v1=<hex hmac of timestamp + body>
            const parts = (headers.get('wave-signature') ?? '').split(',')
            const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
            const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3))
            if (!timestamp || signatures.length === 0) return null
            const expected = createHmac('sha256', secret).update(timestamp + rawBody).digest('hex')
            const valid = signatures.some(s => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)))
            if (!valid) return null
        }
        const event = JSON.parse(rawBody)
        if (event.type !== 'checkout.session.completed') return null
        return { reference: event.data?.client_reference, providerReference: event.data?.id }
    },
}
