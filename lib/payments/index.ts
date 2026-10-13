import { randomBytes } from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { getEventPaymentIntegration, getIntegrationById, type ResolvedIntegration } from '@/lib/integrations/store'
import { webhookUrlFor } from '@/lib/integrations/webhook-url'
import { PaymentProviderError, type NormalizedTransaction, type PaymentAdapter } from './types'
import { priceCheckout } from './pricing'
import { getProvider, providerSupportsCurrency } from '@/lib/integrations/providers'
import { paystack } from './providers/paystack'
import { stripe } from './providers/stripe'
import { flutterwave } from './providers/flutterwave'
import { hubtel } from './providers/hubtel'
import { mpesa } from './providers/mpesa'
import { wave } from './providers/wave'

export { PaymentProviderError } from './types'
export type { NormalizedTransaction } from './types'

const ADAPTERS: Record<string, PaymentAdapter> = { paystack, stripe, flutterwave, hubtel, mpesa, wave }

export function getAdapter(provider: string): PaymentAdapter {
    const adapter = ADAPTERS[provider]
    if (!adapter) throw new PaymentProviderError(`Unsupported payment provider: ${provider}`)
    return adapter
}

export type PaymentSession = {
    reference: string
    organizer_id: string
    integration_id: string | null
    provider: string
    mode: string
    provider_reference: string | null
    amount_minor: number
    currency: string
    reservation_ids: string[]
    metadata: Record<string, unknown>
    status: 'pending' | 'paid' | 'failed'
    transaction: NormalizedTransaction | null
    created_at: string
    paid_at: string | null
}

const sessions = () => createAdminClient().schema('gatepass').from('payment_sessions')

/** 26 chars: short enough for Hubtel's 32-char clientReference and unique enough for every provider. */
const newReference = () => `gp${randomBytes(12).toString('hex')}`

export async function startCheckout(input: {
    reservationIds: string[]
    email: string
    phone?: string | null
    amountMinor: number
    currency: string
    returnUrl: string
    metadata?: Record<string, unknown>
}): Promise<{ reference: string; provider: string; redirectUrl: string }> {
    const admin = createAdminClient()
    const { data: reservation } = await admin
        .schema('gatepass')
        .from('reservations')
        .select('event_id, guest_phone, events(title, organization_id)')
        .eq('id', input.reservationIds[0])
        .single()
    const event = reservation && (Array.isArray(reservation.events) ? reservation.events[0] : reservation.events) as { title: string; organization_id: string } | null
    if (!reservation || !event?.organization_id) throw new PaymentProviderError('Reservation not found')

    const integration = await getEventPaymentIntegration(reservation.event_id)
    if (!integration) throw new PaymentProviderError('This organizer has not connected a payment provider yet.')

    // Charge what the server prices, never what the browser sent
    const metadata = input.metadata ?? {}
    const price = await priceCheckout(input.reservationIds, metadata)
    if (price.amountMinor <= 0) throw new PaymentProviderError('There is nothing to pay for this order')
    if (Math.abs(price.amountMinor - input.amountMinor) > 1 || price.currency !== input.currency.toUpperCase()) {
        console.warn('[payments] Client total differs from server price', {
            reservationIds: input.reservationIds,
            client: `${input.currency} ${input.amountMinor}`,
            server: `${price.currency} ${price.amountMinor}`,
        })
    }

    // Each provider only charges in certain currencies, and some need the buyer's phone
    const definition = getProvider('payments', integration.provider)
    if (!providerSupportsCurrency(integration.provider, price.currency)) {
        throw new PaymentProviderError(`${definition?.name ?? 'This payment provider'} can't charge in ${price.currency}. The organizer needs to change the event's currency or payment provider.`)
    }
    if (definition?.requiresPhone && !(input.phone || reservation.guest_phone)) {
        throw new PaymentProviderError(`Add your phone number to pay with ${definition.name}.`)
    }

    const reference = newReference()
    const returnUrl = new URL(input.returnUrl)
    returnUrl.searchParams.set('reference', reference)

    const { error } = await sessions().insert({
        reference,
        organizer_id: event.organization_id,
        integration_id: integration.id,
        provider: integration.provider,
        mode: integration.mode,
        amount_minor: price.amountMinor,
        currency: price.currency,
        reservation_ids: input.reservationIds,
        metadata,
    })
    if (error) throw new Error(error.message)

    const result = await getAdapter(integration.provider).createCheckout(integration, {
        reference,
        amountMinor: price.amountMinor,
        currency: price.currency,
        email: input.email,
        phone: input.phone || reservation.guest_phone,
        description: event.title || 'GatePass tickets',
        returnUrl: returnUrl.toString(),
        webhookUrl: webhookUrlFor(integration.provider, integration.id, integration.webhookToken),
        metadata: { ...metadata, reference, reservation_ids: input.reservationIds },
    })

    if (result.providerReference) {
        await sessions().update({ provider_reference: result.providerReference }).eq('reference', reference)
    }

    // Push-based providers (M-Pesa) have no hosted page; send the buyer to our waiting page
    const redirectUrl = result.redirectUrl
        ?? `${returnUrl.origin}/pay/${reference}?return=${encodeURIComponent(returnUrl.toString())}`
    return { reference, provider: integration.provider, redirectUrl }
}

export async function getSession(reference: string): Promise<PaymentSession | null> {
    const { data } = await sessions().select('*').eq('reference', reference).maybeSingle()
    return data as PaymentSession | null
}

export async function findSessionByProviderReference(provider: string, providerReference: string): Promise<PaymentSession | null> {
    const { data } = await sessions().select('*').eq('provider', provider).eq('provider_reference', providerReference).maybeSingle()
    return data as PaymentSession | null
}

export type Confirmation =
    | { status: 'success'; session: PaymentSession; transaction: NormalizedTransaction }
    | { status: 'pending' | 'failed'; session: PaymentSession; message: string }

/**
 * Asks the provider for the payment's current state and checks the amount and currency
 * against what the session was opened for. Safe to call repeatedly.
 */
export async function confirmPayment(reference: string, integration?: ResolvedIntegration): Promise<Confirmation> {
    const session = await getSession(reference)
    if (!session) throw new PaymentProviderError('Payment session not found')
    if (session.status === 'paid' && session.transaction) {
        return { status: 'success', session, transaction: session.transaction }
    }

    const resolved = integration ?? (session.integration_id ? await getIntegrationById(session.integration_id) : null)
    if (!resolved) throw new PaymentProviderError('The payment provider for this session has been disconnected')

    const transaction = await getAdapter(session.provider).fetchTransaction(resolved, {
        reference: session.reference,
        providerReference: session.provider_reference,
        amountMinor: Number(session.amount_minor),
        currency: session.currency,
    })

    if (transaction.status === 'pending') {
        return { status: 'pending', session, message: 'Payment is still being processed' }
    }

    if (transaction.status === 'failed') {
        await sessions().update({ status: 'failed' }).eq('reference', reference).eq('status', 'pending')
        return { status: 'failed', session, message: transaction.gateway_response || 'Payment was not completed' }
    }

    // Allow 1 minor unit for provider rounding (major-unit APIs)
    const amountMatches = Math.abs(transaction.amount - Number(session.amount_minor)) <= 1
    const currencyMatches = transaction.currency?.toUpperCase() === session.currency.toUpperCase()
    if (!amountMatches || !currencyMatches) {
        console.error('[payments] Amount mismatch', { reference, expected: session.amount_minor, currency: session.currency, got: transaction.amount, gotCurrency: transaction.currency })
        await sessions().update({ status: 'failed', transaction }).eq('reference', reference)
        return { status: 'failed', session, message: 'The amount paid does not match this order. Please contact the organizer.' }
    }

    // Carry our own metadata through so downstream handlers see reservation and instalment ids
    const enriched: NormalizedTransaction = {
        ...transaction,
        metadata: { ...transaction.metadata, ...session.metadata, reservation_ids: session.reservation_ids },
    }
    await sessions()
        .update({ status: 'paid', transaction: enriched, paid_at: enriched.paid_at ?? new Date().toISOString() })
        .eq('reference', reference)

    return { status: 'success', session: { ...session, status: 'paid', transaction: enriched }, transaction: enriched }
}

/** For handlers called without a transaction: confirm via the session's provider or throw. */
export async function fetchConfirmedTransaction(reference: string): Promise<NormalizedTransaction> {
    const confirmation = await confirmPayment(reference)
    if (confirmation.status !== 'success') throw new PaymentProviderError(confirmation.message)
    return confirmation.transaction
}

/**
 * Issues tickets for an order the server prices at zero (free tickets, or a 100% promo code).
 * No provider is involved, so the transaction is recorded as a GatePass "free" one.
 */
export async function completeFreeOrder(reservationIds: string[]): Promise<{ reference: string; transaction: NormalizedTransaction }> {
    const price = await priceCheckout(reservationIds, {})
    if (price.amountMinor !== 0) throw new PaymentProviderError('This order has a balance to pay')

    const reference = `gpfree${randomBytes(12).toString('hex')}`
    return {
        reference,
        transaction: {
            status: 'success',
            reference,
            amount: 0,
            currency: price.currency,
            channel: 'free',
            paid_at: new Date().toISOString(),
            provider: 'free',
            provider_reference: null,
            customer: { email: null },
            metadata: { reservation_ids: reservationIds, payment_type: 'free' },
        },
    }
}
