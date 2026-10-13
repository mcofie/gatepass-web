'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getPlatformFeeQuote, hasPaymentProvider, startPlatformFeeCheckout, type PlatformFeeQuote, type PricingTier } from '@/lib/billing'

export type EventBillingSummary = PlatformFeeQuote & {
    hasPaidTickets: boolean
    hasPaymentProvider: boolean
}

async function requireEventManager(eventId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const admin = createAdminClient()
    const { data: event } = await admin.schema('gatepass').from('events').select('organization_id').eq('id', eventId).single()
    if (!event?.organization_id) throw new Error('Event not found')

    const { data: org } = await admin.schema('gatepass').from('organizers').select('user_id').eq('id', event.organization_id).single()
    if (org?.user_id !== user.id) {
        const { data: member } = await admin
            .schema('gatepass')
            .from('organization_team')
            .select('role')
            .eq('organization_id', event.organization_id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (member?.role !== 'admin') throw new Error('Only owners and admins can manage billing')
    }
    return { user, organizerId: event.organization_id as string }
}

async function requireSuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    const { data: profile } = await supabase.schema('gatepass').from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!profile?.is_super_admin) throw new Error('Forbidden')
}

export async function getEventBilling(eventId: string): Promise<EventBillingSummary> {
    await requireEventManager(eventId)
    const [quote, provider, { count }] = await Promise.all([
        getPlatformFeeQuote(eventId),
        hasPaymentProvider(eventId),
        createAdminClient().schema('gatepass').from('ticket_tiers').select('id', { count: 'exact', head: true }).eq('event_id', eventId).gt('price', 0),
    ])
    return { ...quote, hasPaidTickets: (count ?? 0) > 0, hasPaymentProvider: provider }
}

export async function payPlatformFee(eventId: string): Promise<{ redirectUrl: string }> {
    const { user, organizerId } = await requireEventManager(eventId)
    if (!user.email) throw new Error('Your account needs an email address to pay')
    const origin = (await headers()).get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    return startPlatformFeeCheckout({
        eventId,
        organizerId,
        userId: user.id,
        email: user.email,
        returnUrl: `${origin}/dashboard/billing/callback`,
    })
}

export async function listPricingTiers(): Promise<PricingTier[]> {
    await requireSuperAdmin()
    const { data, error } = await createAdminClient()
        .schema('gatepass')
        .from('platform_pricing_tiers')
        .select('*')
        .order('sort_order')
    if (error) throw new Error(error.message)
    return data as PricingTier[]
}

export async function savePricingTiers(tiers: Array<Omit<PricingTier, 'id'> & { id?: string }>, removedIds: string[]) {
    await requireSuperAdmin()
    const admin = createAdminClient()

    for (const tier of tiers) {
        if (!tier.name.trim()) throw new Error('Every plan needs a name')
        if (tier.price_minor < 0) throw new Error(`${tier.name}: price can't be negative`)
        if (tier.max_tickets !== null && tier.max_tickets <= 0) throw new Error(`${tier.name}: ticket limit must be positive`)
    }
    if (!tiers.some(t => t.is_active && t.max_tickets === null)) {
        throw new Error('Keep one active plan without a ticket limit, so every event has a plan')
    }

    if (removedIds.length) {
        // Deactivate rather than delete: paid events still reference their tier
        await admin.schema('gatepass').from('platform_pricing_tiers').update({ is_active: false }).in('id', removedIds)
    }
    const rows = tiers.map(t => ({ ...t, name: t.name.trim(), currency: t.currency.toUpperCase(), updated_at: new Date().toISOString() }))
    const { error } = await admin.schema('gatepass').from('platform_pricing_tiers').upsert(rows, { defaultToNull: false })
    if (error) throw new Error(error.message)

    revalidatePath('/admin/settings')
    revalidatePath('/our-offering')
}
