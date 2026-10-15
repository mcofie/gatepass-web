import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'

const API = 'https://api.chapa.co/v1'

/** Chapa (Ethiopia). Test and live are told apart by the key (CHASECK_TEST- / CHASECK-). */
export const chapa: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${API}/transaction/initialize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: toMajor(input.amountMinor).toFixed(2),
                currency: input.currency,
                email: input.email,
                tx_ref: input.reference,
                return_url: input.returnUrl,
                customization: { title: 'GatePass', description: input.description.replace(/[^\w\s.-]/g, '').slice(0, 50) },
            }),
        })
        const data = await readJson(response)
        if (!response.ok || data.status !== 'success' || !data.data?.checkout_url) {
            const message = typeof data.message === 'string' ? data.message : 'Chapa could not start this payment'
            throw new PaymentProviderError(message)
        }
        return { redirectUrl: data.data.checkout_url, providerReference: input.reference }
    },

    async fetchTransaction(integration, session) {
        const response = await fetch(`${API}/transaction/verify/${encodeURIComponent(session.reference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        const tx = data.data
        // Chapa answers "not found" until the buyer has paid
        if (!response.ok || !tx) return pendingFrom(session)
        const status = String(tx.status).toLowerCase()
        return {
            status: status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending',
            reference: session.reference,
            amount: tx.amount !== undefined ? toMinor(tx.amount) : session.amountMinor,
            currency: tx.currency ?? session.currency,
            channel: tx.method ?? tx.payment_method ?? null,
            paid_at: status === 'success' ? (tx.updated_at ?? tx.created_at ?? new Date().toISOString()) : null,
            provider: 'chapa',
            provider_reference: tx.reference ?? session.reference,
            customer: { email: tx.email ?? null },
            metadata: {},
            gateway_response: status,
        }
    },

    async parseWebhook(_integration, { rawBody }) {
        const event = JSON.parse(rawBody || '{}')
        const reference = event.tx_ref ?? event.trx_ref ?? event.data?.tx_ref
        return reference ? { reference } : null
    },
}

function pendingFrom(session: { reference: string; providerReference: string | null; amountMinor: number; currency: string }) {
    return {
        status: 'pending' as const,
        reference: session.reference,
        amount: session.amountMinor,
        currency: session.currency,
        channel: null,
        paid_at: null,
        provider: 'chapa',
        provider_reference: session.providerReference,
        customer: { email: null },
        metadata: {},
    }
}
