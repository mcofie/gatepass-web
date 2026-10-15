import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'

// Cached reads for public pages (event page, embed, pricing). They don't depend on the visitor,
// so they're shared across requests for a few seconds instead of hitting Supabase on every view.
// Checkout re-reads prices and availability on the server, so brief staleness here is safe.
// Pages decide visibility themselves (e.g. drafts are only shown to their organizers).

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export const getEventBySlug = unstable_cache(
    async (slug: string) => {
        const { data } = await createAdminClient()
            .schema('gatepass')
            .from('events')
            .select('*, organizers(user_id, name, description, website, instagram, twitter, logo_url)')
            .eq(isUuid(slug) ? 'id' : 'slug', slug)
            .maybeSingle()
        return data
    },
    ['public-event-by-slug-v1'],
    { revalidate: 30, tags: ['public-events'] },
)

/** Visible ticket types (with payment plans) and active add-ons for an event. */
export const getEventPurchaseData = unstable_cache(
    async (eventId: string) => {
        const db = createAdminClient().schema('gatepass')
        const [{ data: tiers }, { data: addons }] = await Promise.all([
            db.from('ticket_tiers').select('*, payment_plans(*)').eq('event_id', eventId).neq('is_visible', false).order('sort_order', { ascending: true }),
            db.from('event_addons').select('*').eq('event_id', eventId).eq('is_active', true).order('price', { ascending: true }),
        ])
        return { tiers: tiers ?? [], addons: addons ?? [] }
    },
    ['public-event-purchase-v1'],
    // Short: "3 left" style availability should stay close to live
    { revalidate: 15, tags: ['public-events'] },
)

export const getActivePricingTiers = unstable_cache(
    async () => {
        const { data } = await createAdminClient()
            .schema('gatepass')
            .from('platform_pricing_tiers')
            .select('name, max_tickets, price_minor, currency, prices')
            .eq('is_active', true)
            .order('sort_order')
        return (data ?? []) as { name: string; max_tickets: number | null; price_minor: number; currency: string; prices: Record<string, number> | null }[]
    },
    ['public-pricing-tiers-v2'],
    { revalidate: 300, tags: ['pricing-tiers'] },
)

export const getCachedMarketingIds = unstable_cache(
    async (organizerId: string) => (await import('@/lib/integrations/store')).getMarketingIds(organizerId),
    ['public-marketing-ids-v1'],
    { revalidate: 300, tags: ['marketing-ids'] },
)

/** Which payment provider an event charges through (provider id only, for the checkout footer). */
export const getEventPaymentProviderId = unstable_cache(
    async (eventId: string, organizerId: string, overrideIntegrationId: string | null) => {
        let query = createAdminClient().schema('gatepass').from('organizer_integrations').select('provider').eq('organizer_id', organizerId).eq('category', 'payments')
        query = overrideIntegrationId ? query.eq('id', overrideIntegrationId) : query.eq('is_default', true)
        const { data } = await query.maybeSingle()
        return (data?.provider as string | undefined) ?? null
    },
    ['public-event-payment-provider-v1'],
    { revalidate: 60, tags: ['public-events'] },
)
