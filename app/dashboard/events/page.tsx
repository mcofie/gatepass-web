import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { EventsClient } from '@/components/admin/EventsClient'

export const revalidate = 0

export default async function AdminEventsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 1. Determine Organization Context
    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrgId = activeOrgId
    let role = 'Staff'

    // A. Explicit Switch Check
    if (activeOrgId) {
        // Try finding as owner first
        const { data: explicitOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id, user_id')
            .eq('id', activeOrgId)
            // .eq('user_id', user.id) // check later for role
            .maybeSingle()

        if (explicitOrg) {
            if (explicitOrg.user_id === user.id) {
                resolvedOrgId = explicitOrg.id
                role = 'Owner'
            } else {
                // Check team role for this specific org
                const { data: teamRole } = await supabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('role')
                    .eq('organization_id', activeOrgId)
                    .eq('user_id', user.id)
                    .maybeSingle()
                if (teamRole) {
                    resolvedOrgId = explicitOrg.id
                    role = teamRole.role.charAt(0).toUpperCase() + teamRole.role.slice(1)
                } else {
                    resolvedOrgId = undefined
                }
            }
        } else {
            // Check if user is part of this org team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, role')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (teamMember) {
                resolvedOrgId = teamMember.organization_id
                role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
            } else {
                // Cookie invalid or user no longer part of org, reset resolvedOrgId to trigger fallback
                resolvedOrgId = undefined
            }
        }
    }

    // B. Fallback (Default) if no valid org resolved yet
    if (!resolvedOrgId) {
        // Latest Owned
        const { data: latestOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latestOrg) {
            resolvedOrgId = latestOrg.id
            role = 'Owner'
        } else {
            // Latest Team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, role')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle()

            if (teamMember) {
                resolvedOrgId = teamMember.organization_id
                role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
            }
        }
    }

    if (!resolvedOrgId) {
        return redirect('/onboarding')
    }

    const orgId = resolvedOrgId

    try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Server configuration error: Missing Service Key')
        }

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Events with their ticket types (capacity, sold, currency)
        const { data: events, error } = await adminSupabase
            .schema('gatepass')
            .from('events')
            .select('*, ticket_tiers(quantity_sold, total_quantity, currency)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })

        if (error) throw error

        // 2. Gross sales per event. Ticket money now goes straight to the organizer's own
        //    provider, so gross is what they took; provider fees are charged on their side.
        const { data: transactions } = await adminSupabase
            .schema('gatepass')
            .from('transactions')
            .select('amount, reservations!inner ( event_id, events!inner ( organization_id ) )')
            .eq('status', 'success')
            .eq('reservations.events.organization_id', orgId)

        const grossByEvent = new Map<string, number>()
        for (const tx of (transactions ?? []) as unknown as { amount: number; reservations: { event_id: string } }[]) {
            const eventId = tx.reservations.event_id
            grossByEvent.set(eventId, (grossByEvent.get(eventId) ?? 0) + Number(tx.amount || 0))
        }

        // 3. Merge
        type TierStats = { quantity_sold: number | null; total_quantity: number | null; currency: string | null }
        const enrichedEvents = (events as ({ id: string; title: string; slug: string; is_published: boolean; ticket_tiers?: TierStats[] } & Record<string, unknown>)[]).map(event => {
            const tiers = event.ticket_tiers || []
            return {
                ...event,
                ticket_tiers: undefined,
                tier_count: tiers.length,
                tickets_sold: tiers.reduce((acc, t) => acc + (t.quantity_sold || 0), 0),
                // A tier without a limit makes capacity open-ended
                capacity: tiers.some(t => t.total_quantity == null) ? null : tiers.reduce((acc, t) => acc + (t.total_quantity || 0), 0),
                revenue: grossByEvent.get(event.id) ?? 0,
                currency: tiers[0]?.currency || 'GHS',
            }
        })

        return (
            <div className="mx-auto max-w-[1180px]">
                <EventsClient events={enrichedEvents} role={role} />
            </div>
        )

    } catch (error: any) {
        console.error('Fatal Dashboard Error:', error)
        return <div className="mx-auto max-w-[1180px] rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#111]"><h1 className="text-xl font-semibold">Events are unavailable</h1><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Please refresh the page and try again.</p></div>
    }
}
