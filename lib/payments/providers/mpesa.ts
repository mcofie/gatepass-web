import { PaymentProviderError, readJson, toMajor, type PaymentAdapter } from '../types'
import type { ResolvedIntegration } from '@/lib/integrations/store'

const host = (integration: ResolvedIntegration) =>
    integration.mode === 'test' ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke'

async function accessToken(integration: ResolvedIntegration): Promise<string> {
    const c = integration.credentials
    const response = await fetch(`${host(integration)}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${Buffer.from(`${c.consumer_key}:${c.consumer_secret}`).toString('base64')}` },
        cache: 'no-store',
    })
    const data = await readJson(response)
    if (!response.ok || !data.access_token) throw new PaymentProviderError('Safaricom rejected the M-Pesa credentials')
    return data.access_token
}

/** Daraja wants yyyyMMddHHmmss in Kenyan time and base64(shortcode + passkey + timestamp). */
function stkPassword(integration: ResolvedIntegration) {
    const eat = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const timestamp = eat.toISOString().replace(/[-T:]/g, '').slice(0, 14)
    const c = integration.credentials
    return { timestamp, password: Buffer.from(`${c.shortcode}${c.passkey}${timestamp}`).toString('base64') }
}

/** 07XXXXXXXX / +2547XXXXXXXX / 2547XXXXXXXX → 2547XXXXXXXX */
function toMsisdn(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1)
    if (digits.length === 9) return '254' + digits
    return digits
}

export const mpesa: PaymentAdapter = {
    async createCheckout(integration, input) {
        if (input.currency.toUpperCase() !== 'KES') throw new PaymentProviderError('M-Pesa only accepts KES payments')
        if (!input.phone) throw new PaymentProviderError('A Safaricom phone number is required to pay with M-Pesa')
        const msisdn = toMsisdn(input.phone)
        const { timestamp, password } = stkPassword(integration)

        const response = await fetch(`${host(integration)}/mpesa/stkpush/v1/processrequest`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${await accessToken(integration)}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                BusinessShortCode: integration.credentials.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                // KES has no minor unit on M-Pesa
                Amount: Math.ceil(toMajor(input.amountMinor)),
                PartyA: msisdn,
                PartyB: integration.credentials.shortcode,
                PhoneNumber: msisdn,
                CallBackURL: input.webhookUrl,
                AccountReference: input.reference.slice(-12),
                TransactionDesc: input.description.slice(0, 13),
            }),
        })
        const data = await readJson(response)
        if (!response.ok || data.ResponseCode !== '0') throw new PaymentProviderError(data.errorMessage || data.ResponseDescription || 'M-Pesa could not send the payment prompt')
        // No hosted page: the buyer approves on their phone and our /pay page polls for the result
        return { providerReference: data.CheckoutRequestID }
    },

    async fetchTransaction(integration, session) {
        if (!session.providerReference) throw new PaymentProviderError('Missing M-Pesa CheckoutRequestID')
        const { timestamp, password } = stkPassword(integration)
        const response = await fetch(`${host(integration)}/mpesa/stkpushquery/v1/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${await accessToken(integration)}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                BusinessShortCode: integration.credentials.shortcode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: session.providerReference,
            }),
        })
        const data = await readJson(response)
        const base = {
            reference: session.reference,
            // The STK query has no amount; the prompt was sent for exactly the session amount
            amount: session.amountMinor,
            currency: 'KES',
            channel: 'mpesa',
            provider: 'mpesa',
            provider_reference: session.providerReference,
            customer: { email: null },
            metadata: {},
        }
        // Still waiting for the buyer: Daraja answers with an error until the prompt resolves
        if (!response.ok && String(data.errorCode ?? '').startsWith('500.001')) return { ...base, status: 'pending', paid_at: null }
        if (!response.ok) throw new PaymentProviderError(data.errorMessage || 'M-Pesa status check failed')

        const code = String(data.ResultCode)
        return {
            ...base,
            status: code === '0' ? 'success' : 'failed',
            paid_at: code === '0' ? new Date().toISOString() : null,
            gateway_response: data.ResultDesc,
        }
    },

    // Daraja callbacks are unsigned; the URL token authenticates them and the result is re-queried.
    async parseWebhook(_integration, { rawBody }) {
        const callback = JSON.parse(rawBody)?.Body?.stkCallback
        return callback?.CheckoutRequestID ? { providerReference: callback.CheckoutRequestID } : null
    },
}
