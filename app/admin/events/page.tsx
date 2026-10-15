import { createAdminClient } from '@/utils/supabase/admin'
import { AdminHeader, AdminStats } from '@/components/admin/AdminUI'
import { AdminEventsList, type AdminEventRow } from '@/components/admin/AdminEventsList'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export const dynamic = 'force-dynamic'

export default async function AdminEventsPage() {
    // Access is checked in the admin layout; reads go across every organizer
    const db = createAdminClient().schema('gatepass')
    const [{ data: events }, { data: sales }, { data: fees }, { data: managed }] = await Promise.all([
        db.from('events')
            .select('id, title, slug, poster_url, starts_at, ends_at, is_published, is_featured, currency, organization_id, payment_integration_id, organizers(id, name), ticket_tiers(price, currency, total_quantity, quantity_sold)')
            .order('starts_at', { ascending: false })
            .limit(1000),
        db.from('transactions').select('amount, currency, reservations!inner(event_id)').eq('status', 'success').limit(50000),
        db.from('platform_fee_payments').select('event_id, amount_minor, currency').eq('status', 'paid'),
        db.from('organizer_integrations').select('id, organizer_id, is_default').eq('category', 'payments').eq('provider', 'gatepass').eq('status', 'connected'),
    ])

    const salesBy = new Map<string, { amount: number; currency: string }>()
    for (const t of (sales ?? []) as any[]) {
        const id = t.reservations?.event_id
        if (!id) continue
        const prev = salesBy.get(id)
        salesBy.set(id, { amount: (prev?.amount ?? 0) + (Number(t.amount) || 0), currency: prev?.currency ?? t.currency ?? 'GHS' })
    }
    const planPaid = new Set((fees ?? []).map((f: any) => f.event_id))
    const managedIds = new Set((managed ?? []).map((i: any) => i.id))
    const managedDefault = new Set((managed ?? []).filter((i: any) => i.is_default).map((i: any) => i.organizer_id))

    const now = new Date().getTime()
    const rows: AdminEventRow[] = (events ?? []).map((e: any) => {
        const tiers: any[] = e.ticket_tiers ?? []
        const paid = tiers.some(t => Number(t.price) > 0)
        const usesManaged = e.payment_integration_id ? managedIds.has(e.payment_integration_id) : managedDefault.has(e.organization_id)
        const end = new Date(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 12 * 3600_000)).getTime()
        return {
            id: e.id,
            title: e.title,
            slug: e.slug,
            posterUrl: e.poster_url,
            startsAt: e.starts_at,
            organizer: e.organizers?.name ?? null,
            organizerId: e.organizers?.id ?? null,
            published: !!e.is_published,
            featured: !!e.is_featured,
            past: end < now,
            sold: tiers.reduce((sum, t) => sum + (Number(t.quantity_sold) || 0), 0),
            capacity: tiers.reduce((sum, t) => sum + (Number(t.total_quantity) || 0), 0),
            sales: salesBy.get(e.id)?.amount ?? 0,
            currency: salesBy.get(e.id)?.currency ?? e.currency ?? tiers[0]?.currency ?? 'GHS',
            billing: !paid ? 'free' : usesManaged ? 'managed' : planPaid.has(e.id) ? 'plan' : 'unpaid',
        }
    })

    const live = rows.filter(r => r.published && !r.past).length
    const stats = [
        { label: 'Events', value: rows.length.toLocaleString(), detail: `${rows.filter(r => !r.published).length.toLocaleString()} not published` },
        { label: 'Live now', value: live.toLocaleString(), detail: 'Published and not over' },
        { label: 'Featured', value: rows.filter(r => r.featured).length.toLocaleString(), detail: 'Shown on the home page' },
        { label: 'Tickets sold', value: rows.reduce((sum, r) => sum + r.sold, 0).toLocaleString(), detail: 'Across every event' },
    ]

    return (
        <div className="space-y-8 pb-8">
            <AdminHeader title="Events" description="Every event on GatePass. Feature events on the home page, or take one down if it breaks the rules." />
            <AdminStats stats={stats} columns={4} />
            <AdminEventsList events={rows} />
        </div>
    )
}
