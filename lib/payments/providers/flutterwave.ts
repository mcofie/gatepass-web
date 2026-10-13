import { timingSafeEqual } from 'crypto'
import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'

const API = 'https://api.flutterwave.com/v3'

export const flutterwave: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${API}/payments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tx_ref: input.reference,
                amount: toMajor(input.amountMinor),
                currency: input.currency,
                redirect_url: input.returnUrl,
                customer: { email: input.email, ...(input.phone ? { phonenumber: input.phone } : {}) },
                customizations: { title: input.description.slice(0, 100) },
                meta: { reference: input.reference },
            }),
        })
        const data = await readJson(response)
        if (!response.ok || data.status !== 'success') throw new PaymentProviderError(data.message || 'Flutterwave could not start this payment')
        return { redirectUrl: data.data.link, providerReference: input.reference }
    },

    async fetchTransaction(integration, session) {
        const response = await fetch(`${API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(session.reference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok || !data.data) throw new PaymentProviderError(data.message || 'Flutterwave could not find this payment')
        const tx = data.data
        return {
            status: tx.status === 'successful' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending',
            reference: session.reference,
            amount: toMinor(tx.amount),
            currency: tx.currency,
            channel: tx.payment_type ?? null,
            paid_at: tx.created_at ?? null,
            provider: 'flutterwave',
            provider_reference: String(tx.id),
            customer: { email: tx.customer?.email ?? null },
            metadata: tx.meta ?? {},
            gateway_response: tx.processor_response,
        }
    },

    async parseWebhook(integration, { headers, rawBody }) {
        const expected = integration.credentials.webhook_hash
        if (expected) {
            const received = headers.get('verif-hash') ?? ''
            if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null
        }
        const event = JSON.parse(rawBody)
        const tx = event.data ?? event
        return tx?.tx_ref ? { reference: tx.tx_ref } : null
    },
}
