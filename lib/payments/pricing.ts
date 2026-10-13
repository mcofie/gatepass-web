import { createAdminClient } from '@/utils/supabase/admin'
import { PaymentProviderError } from './types'

// The server decides what a checkout costs. Mirrors the checkout screens: tier price with
// quantity discount, one promo code per order (tickets only, optionally limited to one tier,
// never more than what it applies to), add-ons at list price, and no fees.

export type Tier = { id: string; price: number; currency: string | null; min_quantity: number | null; discount_type: string | null; discount_value: number | null }
type Reservation = {
    id: string
    event_id: string
    status: string
    expires_at: string | null
    quantity: number | null
    addons: Record<string, number> | null
    discount_id: string | null
    ticket_tiers: Tier | Tier[] | null
}

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value)
const toMinor = (major: number) => Math.round(major * 100)

/** Tier subtotal after its bulk (quantity) discount. Same rule as every checkout screen. */
function tierSubtotal(tier: Tier, quantity: number): number {
    let subtotal = Number(tier.price) * quantity
    if (tier.min_quantity && quantity >= tier.min_quantity && tier.discount_value) {
        if (tier.discount_type === 'percentage') subtotal -= subtotal * (Number(tier.discount_value) / 100)
        else if (tier.discount_type === 'fixed') subtotal = Math.max(0, subtotal - Number(tier.discount_value))
    }
    return subtotal
}

export type CheckoutPrice = { amountMinor: number; currency: string }

/** Order value in major units: tickets after bulk and promo discounts, plus add-ons. */
export function computeOrderValue(order: {
    lines: { tier: Tier; quantity: number }[]
    discount: { type: string; value: number; tier_id: string | null } | null
    addons: { price: number; quantity: number }[]
}): number {
    const subtotalByTier = new Map<string, number>()
    let ticketSubtotal = 0
    for (const { tier, quantity } of order.lines) {
        const subtotal = tierSubtotal(tier, quantity)
        ticketSubtotal += subtotal
        subtotalByTier.set(tier.id, (subtotalByTier.get(tier.id) ?? 0) + subtotal)
    }

    // Promo code: applied once per order, never more than what it applies to
    let discountAmount = 0
    if (order.discount) {
        const target = order.discount.tier_id ? (subtotalByTier.get(order.discount.tier_id) ?? 0) : ticketSubtotal
        const raw = order.discount.type === 'percentage' ? target * (Number(order.discount.value) / 100) : Number(order.discount.value)
        discountAmount = Math.min(raw, target)
    }

    const addonSubtotal = order.addons.reduce((sum, a) => sum + a.price * a.quantity, 0)
    return Math.max(0, ticketSubtotal - discountAmount) + addonSubtotal
}

export async function priceCheckout(reservationIds: string[], metadata: Record<string, unknown>): Promise<CheckoutPrice> {
    const admin = createAdminClient()
    const db = () => admin.schema('gatepass')
    const paymentType = metadata.payment_type

    // Later instalments are priced from the stored schedule, not the order
    if (paymentType === 'instalment') {
        const instalmentReservationId = String(metadata.instalment_reservation_id ?? '')
        const { data: plan } = await db()
            .from('instalment_reservations')
            .select('id, reservation_id, total_amount, amount_paid, currency, status')
            .eq('id', instalmentReservationId)
            .single()
        if (!plan || !reservationIds.includes(plan.reservation_id)) throw new PaymentProviderError('Instalment plan not found')
        if (plan.status !== 'active') throw new PaymentProviderError('This instalment plan is no longer active')

        if (metadata.is_full_payment) {
            const remaining = Number(plan.total_amount) - Number(plan.amount_paid)
            if (remaining <= 0) throw new PaymentProviderError('This instalment plan is already paid')
            return { amountMinor: toMinor(remaining), currency: plan.currency || 'GHS' }
        }

        const { data: payment } = await db()
            .from('instalment_payments')
            .select('amount, currency, status')
            .eq('id', String(metadata.instalment_payment_id ?? ''))
            .eq('instalment_reservation_id', plan.id)
            .single()
        if (!payment) throw new PaymentProviderError('Instalment payment not found')
        if (payment.status === 'paid') throw new PaymentProviderError('This instalment is already paid')
        return { amountMinor: toMinor(Number(payment.amount)), currency: payment.currency || plan.currency || 'GHS' }
    }

    const { data, error } = await db()
        .from('reservations')
        .select('id, event_id, status, expires_at, quantity, addons, discount_id, ticket_tiers(id, price, currency, min_quantity, discount_type, discount_value)')
        .in('id', reservationIds)
    if (error) throw new Error(error.message)
    const reservations = (data ?? []) as Reservation[]

    if (reservations.length !== new Set(reservationIds).size) throw new PaymentProviderError('Reservation not found')
    if (new Set(reservations.map(r => r.event_id)).size > 1) throw new PaymentProviderError('All tickets must be for the same event')
    if (reservations.some(r => r.status === 'confirmed')) throw new PaymentProviderError('This order has already been paid')
    // Tickets are only held until expires_at; a lapsed hold can't start a new payment
    const lapsed = reservations.some(r => r.status === 'cancelled' || (r.status === 'pending' && r.expires_at && new Date(r.expires_at).getTime() < Date.now()))
    if (lapsed) throw new PaymentProviderError('Your hold on these tickets has ended. Please start again.')

    const tiers = reservations.map(r => one(r.ticket_tiers))
    if (tiers.some(t => !t)) throw new PaymentProviderError('Ticket type not found')
    const currencies = new Set(tiers.map(t => (t!.currency || 'GHS').toUpperCase()))
    if (currencies.size > 1) throw new PaymentProviderError('Tickets in one order must share a currency')
    const currency = [...currencies][0]

    // Promo code and add-on prices come from the database
    const discountId = reservations.find(r => r.discount_id)?.discount_id
    const { data: discount } = discountId
        ? await db().from('discounts').select('type, value, tier_id').eq('id', discountId).single()
        : { data: null }

    const addonQuantities: Record<string, number> = {}
    for (const r of reservations) {
        for (const [id, qty] of Object.entries(r.addons ?? {})) {
            if (Number(qty) > 0) addonQuantities[id] = (addonQuantities[id] ?? 0) + Number(qty)
        }
    }
    const addonIds = Object.keys(addonQuantities)
    const { data: addons } = addonIds.length
        ? await db().from('event_addons').select('id, price').eq('event_id', reservations[0].event_id).in('id', addonIds)
        : { data: [] as { id: string; price: number }[] }
    if ((addons?.length ?? 0) !== addonIds.length) throw new PaymentProviderError('An add-on in this order is no longer available')

    const orderValue = computeOrderValue({
        lines: reservations.map((r, i) => ({ tier: tiers[i]!, quantity: r.quantity || 1 })),
        discount,
        addons: (addons ?? []).map(a => ({ price: Number(a.price), quantity: addonQuantities[a.id] })),
    })

    // First instalment: the plan's deposit share of the order, rounded to the cent like the checkout
    if (paymentType === 'instalment_first') {
        const { data: plan } = await db()
            .from('payment_plans')
            .select('tier_id, initial_percent, is_active')
            .eq('id', String(metadata.payment_plan_id ?? ''))
            .single()
        if (!plan?.is_active || !tiers.some(t => t!.id === plan.tier_id)) throw new PaymentProviderError('This payment plan is not available for these tickets')
        const deposit = Math.round(orderValue * Number(plan.initial_percent) / 100 * 100) / 100
        return { amountMinor: toMinor(deposit), currency }
    }

    return { amountMinor: toMinor(orderValue), currency }
}
