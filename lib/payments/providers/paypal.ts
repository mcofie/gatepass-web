import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'
import type { ResolvedIntegration } from '@/lib/integrations/store'

const api = (integration: ResolvedIntegration) =>
    integration.mode === 'test' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

export async function paypalToken(integration: ResolvedIntegration): Promise<string> {
    const c = integration.credentials
    const response = await fetch(`${api(integration)}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${c.client_id}:${c.client_secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        cache: 'no-store',
    })
    const data = await readJson(response)
    if (!response.ok || !data.access_token) throw new PaymentProviderError('PayPal rejected the client ID or secret')
    return data.access_token
}

/** Orders v2: create → buyer approves on PayPal → we capture when we check the status. */
export const paypal: PaymentAdapter = {
    async createCheckout(integration, input) {
        const response = await fetch(`${api(integration)}/v2/checkout/orders`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${await paypalToken(integration)}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `create-${input.reference}` },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    reference_id: input.reference,
                    custom_id: input.reference,
                    invoice_id: input.reference,
                    description: input.description.slice(0, 127),
                    amount: { currency_code: input.currency, value: toMajor(input.amountMinor).toFixed(2) },
                }],
                payment_source: {
                    paypal: {
                        experience_context: {
                            return_url: input.returnUrl,
                            cancel_url: input.returnUrl,
                            user_action: 'PAY_NOW',
                            shipping_preference: 'NO_SHIPPING',
                        },
                    },
                },
            }),
        })
        const data = await readJson(response)
        const approve = (data.links ?? []).find((l: { rel: string }) => l.rel === 'payer-action' || l.rel === 'approve')
        if (!response.ok || !approve) throw new PaymentProviderError(data.details?.[0]?.description || data.message || 'PayPal could not start this payment')
        return { redirectUrl: approve.href, providerReference: data.id }
    },

    async fetchTransaction(integration, session) {
        if (!session.providerReference) throw new PaymentProviderError('Missing PayPal order ID')
        const token = await paypalToken(integration)
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        let response = await fetch(`${api(integration)}/v2/checkout/orders/${encodeURIComponent(session.providerReference)}`, { headers, cache: 'no-store' })
        let order = await readJson(response)
        if (!response.ok) throw new PaymentProviderError(order.message || 'PayPal could not find this order')

        // Approved orders are captured here; the request id makes repeated checks safe
        if (order.status === 'APPROVED') {
            response = await fetch(`${api(integration)}/v2/checkout/orders/${encodeURIComponent(session.providerReference)}/capture`, {
                method: 'POST',
                headers: { ...headers, 'PayPal-Request-Id': `capture-${session.reference}` },
                cache: 'no-store',
            })
            order = await readJson(response)
            if (!response.ok) throw new PaymentProviderError(order.details?.[0]?.description || 'PayPal could not capture this payment')
        }

        const capture = order.purchase_units?.[0]?.payments?.captures?.[0]
        const completed = order.status === 'COMPLETED' && (!capture || capture.status === 'COMPLETED')
        const amount = capture?.amount ?? order.purchase_units?.[0]?.amount
        return {
            status: completed ? 'success' : order.status === 'VOIDED' || capture?.status === 'DECLINED' ? 'failed' : 'pending',
            reference: session.reference,
            amount: amount ? toMinor(amount.value) : session.amountMinor,
            currency: amount?.currency_code ?? session.currency,
            channel: 'paypal',
            paid_at: completed ? (capture?.create_time ?? new Date().toISOString()) : null,
            provider: 'paypal',
            provider_reference: capture?.id ?? session.providerReference,
            customer: { email: order.payer?.email_address ?? null },
            metadata: {},
            gateway_response: capture?.status_details?.reason ?? order.status,
        }
    },

    // The URL token authenticates the call and the order is re-fetched, so the body only needs the order id
    async parseWebhook(_integration, { rawBody }) {
        const event = JSON.parse(rawBody)
        const resource = event?.resource ?? {}
        const orderId = event?.event_type?.startsWith('CHECKOUT.ORDER') ? resource.id : resource.supplementary_data?.related_ids?.order_id
        return orderId ? { providerReference: orderId } : null
    },
}
