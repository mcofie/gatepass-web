import { createHmac, timingSafeEqual } from 'crypto'
import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'

const API = 'https://api.korapay.com/merchant/api/v1'

/** Korapay hosted checkout. Test and live are told apart by the key (sk_test_ / sk_live_). */
export const korapay: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${API}/charges/initialize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: toMajor(input.amountMinor),
                currency: input.currency,
                reference: input.reference,
                redirect_url: input.returnUrl,
                notification_url: input.webhookUrl,
                narration: input.description.slice(0, 100),
                customer: { email: input.email },
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.status || !data.data?.checkout_url) throw new PaymentProviderError(data.message || 'Korapay could not start this payment')
        return { redirectUrl: data.data.checkout_url, providerReference: input.reference }
    },

    async fetchTransaction(integration, session) {
        const response = await fetch(`${API}/charges/${encodeURIComponent(session.reference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok || !data.data) throw new PaymentProviderError(data.message || 'Korapay could not find this payment')
        const tx = data.data
        return {
            status: tx.status === 'success' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending',
            reference: session.reference,
            amount: tx.amount !== undefined ? toMinor(tx.amount) : session.amountMinor,
            currency: tx.currency ?? session.currency,
            channel: tx.payment_method ?? null,
            paid_at: tx.status === 'success' ? (tx.transaction_date ?? new Date().toISOString()) : null,
            provider: 'korapay',
            provider_reference: tx.payment_reference ?? session.reference,
            customer: { email: tx.customer?.email ?? null },
            metadata: {},
            gateway_response: tx.message ?? tx.status,
        }
    },

    async parseWebhook(integration, { headers, rawBody }) {
        const event = JSON.parse(rawBody || '{}')
        // Korapay signs only the "data" object with the secret key
        const signature = headers.get('x-korapay-signature') ?? ''
        const expected = createHmac('sha256', integration.credentials.secret_key).update(JSON.stringify(event.data ?? {})).digest('hex')
        if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
        return event.data?.reference ? { reference: event.data.reference } : null
    },
}
