import { createAdminClient } from '@/utils/supabase/admin'

// Public, read-only view of published events for the embed loader, SDKs and the MCP server.
// Only fields a buyer would see on the event page are exposed.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so').replace(/\/$/, '')
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** Event descriptions are rich text; the API returns plain text. */
const toPlainText = (html: string | null) =>
    (html ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n').trim()

type TierRow = {
    id: string; name: string; description: string | null; price: number; currency: string | null
    total_quantity: number | null; quantity_sold: number | null; max_per_order: number | null
    is_virtual: boolean | null; sort_order: number | null; is_visible: boolean | null
}
type EventRow = {
    id: string; slug: string | null; title: string; description: string | null
    starts_at: string; ends_at: string | null; venue_name: string | null; venue_address: string | null
    latitude: number | null; longitude: number | null; poster_url: string | null; primary_color: string | null
    sales_enabled: boolean | null
    organizers: { name: string; slug: string | null; logo_url: string | null } | null
    ticket_tiers: TierRow[]
}

export type PublicTicket = {
    id: string
    name: string
    description: string | null
    price: number
    currency: string
    available: number | null
    sold_out: boolean
    max_per_order: number | null
    online: boolean
}

export type PublicEvent = {
    id: string
    slug: string
    title: string
    description: string
    starts_at: string
    ends_at: string | null
    venue: { name: string | null; address: string | null; latitude: number | null; longitude: number | null }
    image_url: string | null
    accent_color: string | null
    organizer: { name: string; handle: string | null; logo_url: string | null } | null
    on_sale: boolean
    from_price: { amount: number; currency: string } | null
    tickets: PublicTicket[]
    url: string
    checkout_url: string
    embed_url: string
}

const EVENT_FIELDS = `
    id, slug, title, description, starts_at, ends_at, venue_name, venue_address, latitude, longitude,
    poster_url, primary_color, sales_enabled,
    organizers ( name, slug, logo_url ),
    ticket_tiers ( id, name, description, price, currency, total_quantity, quantity_sold, max_per_order, is_virtual, sort_order, is_visible )
`

function toPublic(row: EventRow): PublicEvent {
    const slug = row.slug || row.id
    const tickets: PublicTicket[] = (row.ticket_tiers ?? [])
        .filter(t => t.is_visible !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(t => {
            const available = t.total_quantity == null ? null : Math.max(0, t.total_quantity - (t.quantity_sold ?? 0))
            return {
                id: t.id,
                name: t.name,
                description: t.description,
                price: Number(t.price),
                currency: (t.currency || 'GHS').toUpperCase(),
                available,
                sold_out: available === 0,
                max_per_order: t.max_per_order,
                online: Boolean(t.is_virtual),
            }
        })
    const buyable = tickets.filter(t => !t.sold_out)
    const cheapest = buyable.reduce<PublicTicket | null>((min, t) => (!min || t.price < min.price ? t : min), null)
    const ended = new Date(row.ends_at ?? row.starts_at).getTime() < Date.now()

    return {
        id: row.id,
        slug,
        title: row.title,
        description: toPlainText(row.description),
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        venue: { name: row.venue_name, address: row.venue_address, latitude: row.latitude, longitude: row.longitude },
        image_url: row.poster_url,
        accent_color: row.primary_color,
        organizer: row.organizers ? { name: row.organizers.name, handle: row.organizers.slug, logo_url: row.organizers.logo_url } : null,
        on_sale: !ended && row.sales_enabled !== false && buyable.length > 0,
        from_price: cheapest ? { amount: cheapest.price, currency: cheapest.currency } : null,
        tickets,
        url: `${SITE_URL}/events/${slug}`,
        checkout_url: `${SITE_URL}/events/${slug}?view=tickets`,
        embed_url: `${SITE_URL}/embed/${slug}`,
    }
}

export async function getPublicEvent(slugOrId: string): Promise<PublicEvent | null> {
    const { data } = await createAdminClient()
        .schema('gatepass')
        .from('events')
        .select(EVENT_FIELDS)
        .eq(isUuid(slugOrId) ? 'id' : 'slug', slugOrId)
        .eq('is_published', true)
        .maybeSingle()
    return data ? toPublic(data as unknown as EventRow) : null
}

/** Published events, soonest first. Upcoming only unless includePast. */
export async function listPublicEvents(options: { organizerHandle?: string; query?: string; includePast?: boolean; limit?: number } = {}): Promise<PublicEvent[]> {
    const db = createAdminClient().schema('gatepass')
    let organizerId: string | null = null
    if (options.organizerHandle) {
        const { data: org } = await db.from('organizers').select('id').eq('slug', options.organizerHandle).maybeSingle()
        if (!org) return []
        organizerId = org.id
    }

    let q = db.from('events').select(EVENT_FIELDS).eq('is_published', true)
    if (organizerId) q = q.eq('organization_id', organizerId)
    if (!options.includePast) q = q.gte('starts_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    if (options.query) {
        const term = options.query.replace(/[%,()]/g, ' ').trim()
        if (term) q = q.or(`title.ilike.%${term}%,venue_name.ilike.%${term}%,venue_address.ilike.%${term}%`)
    }
    const { data } = await q.order('starts_at', { ascending: true }).limit(Math.min(options.limit ?? 20, 50))
    return ((data ?? []) as unknown as EventRow[]).map(toPublic)
}

export const PUBLIC_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
}
