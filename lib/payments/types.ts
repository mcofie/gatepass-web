import type { ResolvedIntegration } from '@/lib/integrations/store'

export type CheckoutInput = {
    reference: string
    /** Amount × 100, as every checkout client sends it */
    amountMinor: number
    currency: string
    email: string
    phone?: string | null
    description: string
    /** Where the buyer returns to; already contains ?reference=<ours> */
    returnUrl: string
    /** This integration's webhook URL, for providers that take it per request */
    webhookUrl: string
    metadata: Record<string, unknown>
}

export type CheckoutResult = {
    /** Hosted checkout page. Absent for push-based providers (M-Pesa STK). */
    redirectUrl?: string
    providerReference?: string
}

export type SessionRef = {
    reference: string
    providerReference: string | null
    amountMinor: number
    currency: string
}

/** Same shape processSuccessfulPayment and the instalment handlers already read (Paystack-style). */
export type NormalizedTransaction = {
    status: 'success' | 'pending' | 'failed'
    reference: string
    /** Amount × 100 */
    amount: number
    currency: string
    channel: string | null
    paid_at: string | null
    provider: string
    provider_reference: string | null
    customer: { email: string | null }
    metadata: Record<string, unknown>
    gateway_response?: string
}

export type WebhookRequest = {
    headers: Headers
    rawBody: string
}

/** What a webhook tells us to look up. The transaction itself is always re-fetched from the provider. */
export type WebhookHint = { reference?: string; providerReference?: string }

export interface PaymentAdapter {
    createCheckout(integration: ResolvedIntegration, input: CheckoutInput): Promise<CheckoutResult>
    fetchTransaction(integration: ResolvedIntegration, session: SessionRef): Promise<NormalizedTransaction>
    /** Returns null when the signature is invalid or the event is irrelevant. */
    parseWebhook(integration: ResolvedIntegration, request: WebhookRequest): Promise<WebhookHint | null>
}

export class PaymentProviderError extends Error {}

// Provider responses are untyped JSON; each adapter reads only the fields it documents
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson(response: Response): Promise<any> {
    return response.json().catch(() => ({}))
}

export const toMajor = (amountMinor: number) => Math.round(amountMinor) / 100
export const toMinor = (major: number | string) => Math.round(Number(major) * 100)
