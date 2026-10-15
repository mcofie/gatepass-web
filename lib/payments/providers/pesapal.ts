import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'
import type { ResolvedIntegration } from '@/lib/integrations/store'

const api = (integration: ResolvedIntegration) =>
    integration.mode === 'test' ? 'https://cybqa.pesapal.com/pesapalv3' : 'https://pay.pesapal.com/v3'

export async function pesapalToken(integration: ResolvedIntegration): Promise<string> {
    const response = await fetch(`${api(integration)}/api/Auth/RequestToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ consumer_key: integration.credentials.consumer_key, consumer_secret: integration.credentials.consumer_secret }),
        cache: 'no-store',
    })
    const data = await readJson(response)
    if (!response.ok || !data.token) throw new PaymentProviderError(data.error?.message || 'Pesapal rejected the consumer key or secret')
    return data.token
}

/** Pesapal API 3.0: register our IPN URL, submit the order, send the buyer to Pesapal's page. */
export const pesapal: PaymentAdapter = {
    async createCheckout(integration, input) {
        const token = await pesapalToken(integration)
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }

        // Registering the same URL again returns its existing id
        const ipnResponse = await fetch(`${api(integration)}/api/URLSetup/RegisterIPN`, {
            method: 'POST', headers, body: JSON.stringify({ url: input.webhookUrl, ipn_notification_type: 'POST' }),
        })
        const ipn = await readJson(ipnResponse)
        if (!ipnResponse.ok || !ipn.ipn_id) throw new PaymentProviderError(ipn.error?.message || 'Pesapal could not register the payment notification URL')

        const response = await fetch(`${api(integration)}/api/Transactions/SubmitOrderRequest`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                id: input.reference,
                currency: input.currency,
                amount: toMajor(input.amountMinor),
                description: input.description.slice(0, 100),
                callback_url: input.returnUrl,
                notification_id: ipn.ipn_id,
                billing_address: { email_address: input.email, phone_number: input.phone ?? '' },
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.redirect_url) throw new PaymentProviderError(data.error?.message || 'Pesapal could not start this payment')
        return { redirectUrl: data.redirect_url, providerReference: data.order_tracking_id }
    },

    async fetchTransaction(integration, session) {
        if (!session.providerReference) throw new PaymentProviderError('Missing Pesapal order tracking ID')
        const response = await fetch(`${api(integration)}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(session.providerReference)}`, {
            headers: { Authorization: `Bearer ${await pesapalToken(integration)}`, Accept: 'application/json' },
            cache: 'no-store',
        })
        const data = await readJson(response)
        if (!response.ok) throw new PaymentProviderError(data.error?.message || 'Pesapal could not find this payment')
        // 1 Completed · 2 Failed · 3 Reversed · 0 Invalid (not paid yet)
        const code = Number(data.status_code)
        return {
            status: code === 1 ? 'success' : code === 2 || code === 3 ? 'failed' : 'pending',
            reference: session.reference,
            amount: data.amount !== undefined ? toMinor(data.amount) : session.amountMinor,
            currency: data.currency ?? session.currency,
            channel: data.payment_method ?? null,
            paid_at: code === 1 ? (data.created_date ?? new Date().toISOString()) : null,
            provider: 'pesapal',
            provider_reference: data.confirmation_code || session.providerReference,
            customer: { email: null },
            metadata: {},
            gateway_response: data.payment_status_description ?? data.description,
        }
    },

    async parseWebhook(_integration, { rawBody }) {
        const body = JSON.parse(rawBody || '{}')
        if (body.OrderMerchantReference) return { reference: body.OrderMerchantReference }
        return body.OrderTrackingId ? { providerReference: body.OrderTrackingId } : null
    },
}
