import { randomBytes } from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { paystack } from '@/lib/payments/providers/paystack'
import { PaymentProviderError } from '@/lib/payments/types'
import type { ResolvedIntegration } from '@/lib/integrations/store'

// The one-time platform fee is the only money GatePass still collects, so it goes through
// GatePass's own Paystack account (PAYSTACK_SECRET_KEY) using the same adapter organizers use.

export type PlatformFeeQuote = {
    tierId: string | null
    tierName: string | null
    ticketCapacity: number
    priceMinor: number
    currency: string
    paidMinor: number
    amountDueMinor: number
    covered: boolean
}

export type PricingTier = {
    id: string
    name: string
    description: string | null
    max_tickets: number | null
    price_minor: number
    currency: string
    sort_order: number
    is_active: boolean
}

export const isPlatformFeeReference = (reference: string) => reference.startsWith('gpfee')

function gatepassAccount(): ResolvedIntegration {
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY is not defined')
    return {
        id: 'gatepass',
        organizerId: 'gatepass',
        category: 'payments',
        provider: 'paystack',
        mode: secretKey.startsWith('sk_test_') ? 'test' : 'live',
        webhookToken: '',
        credentials: { secret_key: secretKey },
    }
}

export async function getPlatformFeeQuote(eventId: string): Promise<PlatformFeeQuote> {
    const { data, error } = await createAdminClient()
        .schema('gatepass')
        .rpc('event_platform_fee_quote', { p_event_id: eventId })
        .single()
    if (error) throw new Error(error.message)
    const row = data as {
        tier_id: string | null; tier_name: string | null; ticket_capacity: number; price_minor: number | null
        currency: string | null; paid_minor: number; amount_due_minor: number; covered: boolean
    }
    return {
        tierId: row.tier_id,
        tierName: row.tier_name,
        ticketCapacity: row.ticket_capacity,
        priceMinor: Number(row.price_minor ?? 0),
        currency: row.currency ?? 'GHS',
        paidMinor: Number(row.paid_minor),
        amountDueMinor: Number(row.amount_due_minor),
        covered: row.covered,
    }
}

export async function hasPaymentProvider(eventId: string): Promise<boolean> {
    const { data } = await createAdminClient().schema('gatepass').rpc('event_has_payment_provider', { p_event_id: eventId })
    return Boolean(data)
}

export async function startPlatformFeeCheckout(input: {
    eventId: string
    organizerId: string
    userId: string
    email: string
    returnUrl: string
}): Promise<{ redirectUrl: string }> {
    const quote = await getPlatformFeeQuote(input.eventId)
    if (quote.covered || quote.amountDueMinor <= 0) throw new PaymentProviderError('This event is already covered by its plan')
    if (!quote.tierId) throw new PaymentProviderError('No plan covers this many tickets. Please contact support.')

    const { data: tier } = await createAdminClient()
        .schema('gatepass')
        .from('platform_pricing_tiers')
        .select('max_tickets')
        .eq('id', quote.tierId)
        .single()

    const reference = `gpfee${randomBytes(12).toString('hex')}`
    const returnUrl = new URL(input.returnUrl)
    returnUrl.searchParams.set('reference', reference)

    const { error } = await createAdminClient().schema('gatepass').from('platform_fee_payments').insert({
        reference,
        event_id: input.eventId,
        organizer_id: input.organizerId,
        tier_id: quote.tierId,
        amount_minor: quote.amountDueMinor,
        currency: quote.currency,
        covered_tickets: tier?.max_tickets ?? null,
        created_by: input.userId,
    })
    if (error) throw new Error(error.message)

    const checkout = await paystack.createCheckout(gatepassAccount(), {
        reference,
        amountMinor: quote.amountDueMinor,
        currency: quote.currency,
        email: input.email,
        description: `GatePass ${quote.tierName} plan`,
        returnUrl: returnUrl.toString(),
        webhookUrl: '',
        metadata: { type: 'platform_fee', event_id: input.eventId, tier: quote.tierName },
    })
    if (!checkout.redirectUrl) throw new PaymentProviderError('Could not start the platform fee payment')
    return { redirectUrl: checkout.redirectUrl }
}

/** Verifies a platform fee payment with Paystack and records it on the event. Idempotent. */
export async function confirmPlatformFeePayment(reference: string): Promise<{ eventId: string; status: 'paid' | 'pending' | 'failed'; message?: string }> {
    const admin = createAdminClient()
    const { data: payment } = await admin.schema('gatepass').from('platform_fee_payments').select('*').eq('reference', reference).maybeSingle()
    if (!payment) throw new PaymentProviderError('Platform fee payment not found')
    if (payment.status === 'paid') return { eventId: payment.event_id, status: 'paid' }

    const tx = await paystack.fetchTransaction(gatepassAccount(), {
        reference,
        providerReference: reference,
        amountMinor: Number(payment.amount_minor),
        currency: payment.currency,
    })
    if (tx.status === 'pending') return { eventId: payment.event_id, status: 'pending' }
    if (tx.status === 'failed' || Math.abs(tx.amount - Number(payment.amount_minor)) > 1 || tx.currency.toUpperCase() !== payment.currency.toUpperCase()) {
        await admin.schema('gatepass').from('platform_fee_payments').update({ status: 'failed' }).eq('reference', reference).eq('status', 'pending')
        return { eventId: payment.event_id, status: 'failed', message: tx.gateway_response || 'Payment was not completed' }
    }

    // Claim the payment exactly once, so a webhook and the return page can't both credit it
    const { data: claimed } = await admin
        .schema('gatepass')
        .from('platform_fee_payments')
        .update({ status: 'paid', paid_at: tx.paid_at ?? new Date().toISOString() })
        .eq('reference', reference)
        .eq('status', 'pending')
        .select('reference')
    if (!claimed?.length) return { eventId: payment.event_id, status: 'paid' }

    const { data: billing } = await admin.schema('gatepass').from('event_billing').select('paid_minor').eq('event_id', payment.event_id).maybeSingle()
    const { error } = await admin.schema('gatepass').from('event_billing').upsert({
        event_id: payment.event_id,
        status: 'paid',
        tier_id: payment.tier_id,
        paid_minor: Number(billing?.paid_minor ?? 0) + Number(payment.amount_minor),
        currency: payment.currency,
        covered_tickets: payment.covered_tickets,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)

    return { eventId: payment.event_id, status: 'paid' }
}

/** Paystack webhook signatures for GatePass's own account. */
export async function parsePlatformFeeWebhook(headers: Headers, rawBody: string): Promise<string | null> {
    const hint = await paystack.parseWebhook(gatepassAccount(), { headers, rawBody })
    return hint?.reference && isPlatformFeeReference(hint.reference) ? hint.reference : null
}
