import { notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { UserDetailClient } from '@/components/admin/UserDetailClient'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export const dynamic = 'force-dynamic'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const admin = createAdminClient()
    const db = admin.schema('gatepass')

    const { data: profile } = await db.from('profiles').select('id, full_name, email, avatar_url, username, phone_number, is_super_admin').eq('id', id).maybeSingle()
    if (!profile) notFound()

    const [{ data: { user } }, { data: owned }, { data: team }, { data: orders }] = await Promise.all([
        admin.auth.admin.getUserById(id),
        db.from('organizers').select('id, name, slug, created_at').eq('user_id', id),
        db.from('organization_team').select('id, role, organizers:organization_id (id, name, slug)').eq('user_id', id),
        db.from('reservations')
            .select('id, created_at, status, quantity, events(id, title, starts_at), ticket_tiers(name, price, currency), transactions(amount, currency, status)')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(50),
    ])

    const orgIds = (owned ?? []).map((o: any) => o.id)
    const [{ data: events }, { data: integrations }] = orgIds.length
        ? await Promise.all([
            db.from('events').select('organization_id').in('organization_id', orgIds),
            db.from('organizer_integrations').select('organizer_id, category, provider, status').in('organizer_id', orgIds).eq('category', 'payments'),
        ])
        : [{ data: [] }, { data: [] }]

    const organizations = [
        ...(owned ?? []).map((o: any) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            role: 'Owner',
            events: (events ?? []).filter((e: any) => e.organization_id === o.id).length,
            payments: (integrations ?? []).filter((i: any) => i.organizer_id === o.id && i.status === 'connected').map((i: any) => i.provider as string),
        })),
        ...(team ?? []).filter((t: any) => t.organizers).map((t: any) => ({ id: t.organizers.id, name: t.organizers.name, slug: t.organizers.slug, role: t.role ? t.role.charAt(0).toUpperCase() + t.role.slice(1) : 'Team', events: null, payments: null })),
    ]

    return (
        <UserDetailClient
            profile={{
                id: profile.id,
                name: profile.full_name,
                email: profile.email ?? user?.email ?? null,
                avatarUrl: profile.avatar_url,
                username: profile.username,
                phone: profile.phone_number ?? user?.phone ?? null,
                admin: !!profile.is_super_admin,
            }}
            account={{
                joinedAt: user?.created_at ?? null,
                lastSeenAt: user?.last_sign_in_at ?? null,
                suspended: !!(user as any)?.banned_until && new Date((user as any).banned_until).getTime() > new Date().getTime(),
                provider: (user?.app_metadata?.provider as string | undefined) ?? null,
            }}
            organizations={organizations}
            orders={(orders ?? []).map((r: any) => {
                const paid = (r.transactions ?? []).find((t: any) => t.status === 'success')
                return {
                    id: r.id,
                    createdAt: r.created_at,
                    status: r.status,
                    quantity: r.quantity ?? 1,
                    eventId: r.events?.id ?? null,
                    event: r.events?.title ?? 'Deleted event',
                    tier: r.ticket_tiers?.name ?? 'Ticket',
                    amount: paid ? Number(paid.amount) : null,
                    currency: paid?.currency ?? r.ticket_tiers?.currency ?? 'GHS',
                }
            })}
        />
    )
}
