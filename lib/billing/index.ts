import { randomBytes } from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { paystack } from '@/lib/payments/providers/paystack'
import { PaymentProviderError } from '@/lib/payments/types'
import type { ResolvedIntegration } from '@/lib/integrations/store'
import { resolveTierPrice, priceIn } from './prices'

export { PRICE_CURRENCIES, priceIn, resolveTierPrice } from './prices'

// The one-time platform fee is the only money GatePass still collects, so it goes through
// GatePass's own Paystack account (PAYSTACK_SECRET_KEY) using the same adapter organizers use.

export type PlatformFeeQuote = {
    tierId: string | null
    tierName: string | null
    ticketCapacity: number
    /** The plan price in the event's currency when one is set, otherwise the base price */
    priceMinor: number
    currency: string
    /** What GatePass's account will actually charge (may differ from the display currency) */
    chargeMinor: number
    chargeCurrency: string
    /** Still due, in the charge currency */
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
    prices: Record<string, number>
    sort_order: number
    is_active: boolean
}

/** Currencies GatePass's own Paystack account can charge (PLATFORM_CHARGE_CURRENCIES, default GHS). */
export function chargeableCurrencies(): string[] {
    return (process.env.PLATFORM_CHARGE_CURRENCIES || 'GHS').split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
}

export const isPlatformFeeReference = (reference: string) => reference.startsWith('gpfee')

/** GatePass's own Paystack account (PAYSTACK_SECRET_KEY), used for platform fees and GatePass Payments */
export function gatepassAccount(): ResolvedIntegration {
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
    const db = createAdminClient().schema('gatepass')
    const [{ data, error }, { data: event }, { data: billing }] = await Promise.all([
        db.rpc('event_platform_fee_quote', { p_event_id: eventId }).single(),
        db.from('events').select('currency').eq('id', eventId).single(),
        db.from('event_billing').select('status, tier_id, paid_minor, currency').eq('event_id', eventId).maybeSingle(),
    ])
    if (error) throw new Error(error.message)
    const row = data as { tier_id: string | null; tier_name: string | null; ticket_capacity: number; covered: boolean }

    const empty = { tierId: row.tier_id, tierName: row.tier_name, ticketCapacity: row.ticket_capacity, priceMinor: 0, currency: 'GHS', chargeMinor: 0, chargeCurrency: 'GHS', amountDueMinor: 0, covered: row.covered }
    if (!row.tier_id) return empty

    const tierIds = [row.tier_id, billing?.tier_id].filter(Boolean) as string[]
    const { data: tiers } = await db.from('platform_pricing_tiers').select('id, price_minor, currency, prices').in('id', tierIds)
    const tier = tiers?.find(t => t.id === row.tier_id)
    if (!tier) return empty

    const { display, charge } = resolveTierPrice(tier, (event?.currency as string) || tier.currency, chargeableCurrencies())

    // Credit what was already paid for a smaller plan, in the charge currency
    let credit = 0
    if (billing?.status === 'paid') {
        if (billing.currency?.toUpperCase() === charge.currency) credit = Number(billing.paid_minor ?? 0)
        else {
            const previous = tiers?.find(t => t.id === billing.tier_id)
            credit = previous ? priceIn(previous, charge.currency) ?? 0 : 0
        }
    }

    return {
        ...empty,
        priceMinor: display.amountMinor,
        currency: display.currency,
        chargeMinor: charge.amountMinor,
        chargeCurrency: charge.currency,
        amountDueMinor: row.covered ? 0 : Math.max(charge.amountMinor - credit, 0),
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
        currency: quote.chargeCurrency,
        covered_tickets: tier?.max_tickets ?? null,
        created_by: input.userId,
    })
    if (error) throw new Error(error.message)

    const checkout = await paystack.createCheckout(gatepassAccount(), {
        reference,
        amountMinor: quote.amountDueMinor,
        currency: quote.chargeCurrency,
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

    // paid_minor records what the covered plan is worth in this currency, the credit for any later upgrade
    const { data: tier } = payment.tier_id
        ? await admin.schema('gatepass').from('platform_pricing_tiers').select('price_minor, currency, prices').eq('id', payment.tier_id).maybeSingle()
        : { data: null }
    const planValue = tier ? priceIn(tier, payment.currency) : null
    const { data: billing } = await admin.schema('gatepass').from('event_billing').select('paid_minor, currency').eq('event_id', payment.event_id).maybeSingle()
    const previous = billing?.currency?.toUpperCase() === payment.currency.toUpperCase() ? Number(billing?.paid_minor ?? 0) : 0
    const { error } = await admin.schema('gatepass').from('event_billing').upsert({
        event_id: payment.event_id,
        status: 'paid',
        tier_id: payment.tier_id,
        paid_minor: planValue ?? previous + Number(payment.amount_minor),
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

/** Any signed charge.success on GatePass's account: platform fees and GatePass Payments ticket sales. */
export async function parseGatepassWebhook(headers: Headers, rawBody: string): Promise<string | null> {
    const hint = await paystack.parseWebhook(gatepassAccount(), { headers, rawBody })
    return hint?.reference ?? null
}
