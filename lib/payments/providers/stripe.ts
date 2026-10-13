import { createHmac, timingSafeEqual } from 'crypto'
import { PaymentProviderError, readJson, toMajor, type PaymentAdapter } from '../types'

const API = 'https://api.stripe.com/v1'

// Stripe expects whole units for zero-decimal currencies
const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])

const toStripeAmount = (amountMinor: number, currency: string) =>
    ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(toMajor(amountMinor)) : Math.round(amountMinor)
const fromStripeAmount = (amount: number, currency: string) =>
    ZERO_DECIMAL.has(currency.toUpperCase()) ? amount * 100 : amount

/** Stripe's form encoding for nested params, e.g. metadata[reference]=… */
function form(params: Record<string, string | number | undefined>) {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value !== undefined) body.set(key, String(value))
    return body
}

export const stripe: PaymentAdapter = {
    async createCheckout(integration, input) {
        const metadata = Object.fromEntries(
            Object.entries({ ...input.metadata, reference: input.reference })
                .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
                .slice(0, 40)
                .map(([k, v]) => [`metadata[${k}]`, String(v).slice(0, 500)])
        )
        const response = await fetch(`${API}/checkout/sessions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form({
                mode: 'payment',
                'line_items[0][quantity]': 1,
                'line_items[0][price_data][currency]': input.currency.toLowerCase(),
                'line_items[0][price_data][unit_amount]': toStripeAmount(input.amountMinor, input.currency),
                'line_items[0][price_data][product_data][name]': input.description,
                customer_email: input.email,
                client_reference_id: input.reference,
                success_url: input.returnUrl,
                cancel_url: input.returnUrl,
                ...metadata,
            }),
        })
        const data = await readJson(response)
        if (!response.ok) throw new PaymentProviderError(data.error?.message || 'Stripe could not start this payment')
        return { redirectUrl: data.url, providerReference: data.id }
    },

    async fetchTransaction(integration, session) {
        if (!session.providerReference) throw new PaymentProviderError('Missing Stripe session id')
        const response = await fetch(`${API}/checkout/sessions/${encodeURIComponent(session.providerReference)}`, {
            headers: { Authorization: `Bearer ${integration.credentials.secret_key}` },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok) throw new PaymentProviderError(data.error?.message || 'Stripe could not find this payment')
        const currency = String(data.currency || session.currency).toUpperCase()
        return {
            status: data.payment_status === 'paid' ? 'success' : data.status === 'expired' ? 'failed' : 'pending',
            reference: session.reference,
            amount: fromStripeAmount(Number(data.amount_total), currency),
            currency,
            channel: 'card',
            paid_at: data.payment_status === 'paid' ? new Date().toISOString() : null,
            provider: 'stripe',
            provider_reference: data.payment_intent ?? data.id,
            customer: { email: data.customer_details?.email ?? data.customer_email ?? null },
            metadata: data.metadata ?? {},
        }
    },

    async parseWebhook(integration, { headers, rawBody }) {
        const secret = integration.credentials.webhook_secret
        if (secret) {
            // Stripe-Signature: t=<timestamp>,v1=<hex hmac of "t.body">
            const parts = Object.fromEntries((headers.get('stripe-signature') ?? '').split(',').map(p => p.split('=') as [string, string]))
            if (!parts.t || !parts.v1) return null
            if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return null
            const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')
            if (parts.v1.length !== expected.length || !timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected))) return null
        }
        // Without a signing secret the URL token is the only check; the session is still re-fetched from Stripe.
        const event = JSON.parse(rawBody)
        if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return null
        return { reference: event.data?.object?.client_reference_id, providerReference: event.data?.object?.id }
    },
}
