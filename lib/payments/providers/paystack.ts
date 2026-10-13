import { createHmac, timingSafeEqual } from 'crypto'
import { PaymentProviderError, readJson, type PaymentAdapter } from '../types'

const API = 'https://api.paystack.co'

export const paystack: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${API}/transaction/initialize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: input.email,
                amount: input.amountMinor,
                currency: input.currency,
                reference: input.reference,
                callback_url: input.returnUrl,
                metadata: input.metadata,
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.status) throw new PaymentProviderError(data.message || 'Paystack could not start this payment')
        return { redirectUrl: data.data.authorization_url, providerReference: input.reference }
    },

    async fetchTransaction(integration, session) {
        const response = await fetch(`${API}/transaction/verify/${encodeURIComponent(session.reference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok || !data.data) throw new PaymentProviderError(data.message || 'Paystack could not find this payment')
        const tx = data.data
        return {
            status: tx.status === 'success' ? 'success' : ['failed', 'abandoned', 'reversed'].includes(tx.status) ? 'failed' : 'pending',
            reference: session.reference,
            amount: Number(tx.amount),
            currency: tx.currency,
            channel: tx.channel ?? null,
            paid_at: tx.paid_at ?? tx.paidAt ?? null,
            provider: 'paystack',
            provider_reference: String(tx.id ?? session.reference),
            customer: { email: tx.customer?.email ?? null },
            metadata: tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {},
            gateway_response: tx.gateway_response,
        }
    },

    async parseWebhook(integration, { headers, rawBody }) {
        const signature = headers.get('x-paystack-signature') ?? ''
        const expected = createHmac('sha512', integration.credentials.secret_key).update(rawBody).digest('hex')
        if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
        const event = JSON.parse(rawBody)
        if (event.event !== 'charge.success') return null
        return { reference: event.data?.reference }
    },
}
