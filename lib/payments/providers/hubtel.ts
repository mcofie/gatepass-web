import { PaymentProviderError, readJson, toMajor, toMinor, type PaymentAdapter } from '../types'

const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`

export const hubtel: PaymentAdapter = {
    async createCheckout(integration, input) {
        const c = integration.credentials
        if (input.currency.toUpperCase() !== 'GHS') throw new PaymentProviderError('Hubtel only accepts GHS payments')
        const response = await fetch('https://payproxyapi.hubtel.com/items/initiate', {
            method: 'POST',
            headers: { Authorization: basic(c.client_id, c.client_secret), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalAmount: toMajor(input.amountMinor),
                description: input.description.slice(0, 100),
                callbackUrl: input.webhookUrl,
                returnUrl: input.returnUrl,
                cancellationUrl: input.returnUrl,
                merchantAccountNumber: c.merchant_account_number,
                clientReference: input.reference,
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.data?.checkoutUrl) throw new PaymentProviderError(data.message || 'Hubtel could not start this payment')
        return { redirectUrl: data.data.checkoutUrl, providerReference: data.data.checkoutId ?? input.reference }
    },

    async fetchTransaction(integration, session) {
        const c = integration.credentials
        const url = `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(c.merchant_account_number)}/status?clientReference=${encodeURIComponent(session.reference)}`
        const response = await fetch(url, { headers: { Authorization: basic(c.client_id, c.client_secret) }, cache: 'no-store' })
        const data = await readJson(response)
        if (!response.ok || !data.data) throw new PaymentProviderError(data.message || 'Hubtel could not find this payment')
        const tx = data.data
        const status = String(tx.status ?? '').toLowerCase()
        return {
            status: status === 'paid' || status === 'success' ? 'success' : status === 'unpaid' || status === 'failed' ? 'failed' : 'pending',
            reference: session.reference,
            amount: toMinor(tx.amount ?? 0),
            currency: tx.currencyCode ?? 'GHS',
            channel: tx.paymentMethod ?? null,
            paid_at: tx.date ?? null,
            provider: 'hubtel',
            provider_reference: tx.transactionId ?? session.providerReference,
            customer: { email: null },
            metadata: {},
        }
    },

    // Hubtel callbacks are unsigned; the URL token authenticates them and the status is re-fetched.
    async parseWebhook(_integration, { rawBody }) {
        const event = JSON.parse(rawBody)
        const reference = event.Data?.ClientReference ?? event.data?.clientReference
        return reference ? { reference } : null
    },
}
