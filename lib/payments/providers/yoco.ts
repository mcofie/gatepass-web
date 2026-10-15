import { PaymentProviderError, readJson, type PaymentAdapter } from '../types'

const API = 'https://payments.yoco.com/api'

/** Yoco Checkout API (South Africa). Test and live are told apart by the key (sk_test_ / sk_live_). */
export const yoco: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${API}/checkouts`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.reference },
            body: JSON.stringify({
                amount: input.amountMinor,
                currency: input.currency,
                successUrl: input.returnUrl,
                cancelUrl: input.returnUrl,
                failureUrl: input.returnUrl,
                externalId: input.reference,
                metadata: { reference: input.reference },
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.redirectUrl) throw new PaymentProviderError(data.description || data.message || 'Yoco could not start this payment')
        return { redirectUrl: data.redirectUrl, providerReference: data.id }
    },

    async fetchTransaction(integration, session) {
        if (!session.providerReference) throw new PaymentProviderError('Missing Yoco checkout ID')
        const response = await fetch(`${API}/checkouts/${encodeURIComponent(session.providerReference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok) throw new PaymentProviderError(data.description || 'Yoco could not find this checkout')
        const completed = data.status === 'completed'
        return {
            status: completed ? 'success' : data.status === 'expired' ? 'failed' : 'pending',
            reference: session.reference,
            amount: Number(data.amount ?? session.amountMinor),
            currency: data.currency ?? session.currency,
            channel: 'card',
            paid_at: completed ? new Date().toISOString() : null,
            provider: 'yoco',
            provider_reference: data.paymentId ?? session.providerReference,
            customer: { email: null },
            metadata: {},
            gateway_response: data.status,
        }
    },

    async parseWebhook(_integration, { rawBody }) {
        const event = JSON.parse(rawBody || '{}')
        const checkoutId = event?.payload?.metadata?.checkoutId
        return checkoutId ? { providerReference: checkoutId } : null
    },
}
