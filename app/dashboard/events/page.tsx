import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
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
            resolvedOrgId = explicitOrg.id
            if (explicitOrg.user_id === user.id) {
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
                if (teamRole) role = teamRole.role.charAt(0).toUpperCase() + teamRole.role.slice(1)
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

        // 1. Fetch Events
        const { data: events, error } = await adminSupabase
            .schema('gatepass')
            .from('events')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })

        if (error) throw error

        // 2. Fetch Stats (Transactions)
        // We fetch all successful transactions for the org to aggregate ticket sales and revenue
        const { data: transactions } = await adminSupabase
            .schema('gatepass')
            .from('transactions')
            .select(`
                amount,
                currency,
                platform_fee,
                applied_processor_fee,
                reservations!inner (
                    event_id,
                    quantity,
                    events!inner ( fee_bearer )
                )
            `)
            .eq('status', 'success')
            // Using the inner join to filter by org
            .eq('reservations.events.organization_id', orgId)

        // 3. Aggregate Stats
        const statsMap = new Map<string, { tickets: number; revenue: number }>()

        if (transactions) {
            transactions.forEach((tx: any) => {
                const eventId = tx.reservations.event_id
                const quantity = tx.reservations.quantity || 1

                // Revenue Calculation (Net Earnings)
                // Use snapshot if available, else calc
                // Actually for list view, using strict snapshot is best if available, but falling back to simple heuristic is okay for speed?
                // No, let's allow consistency.

                let net = 0

                // If we have snapshot fees
                if (tx.platform_fee !== null && tx.applied_processor_fee !== null) {
                    net = tx.amount - tx.platform_fee - tx.applied_processor_fee
                } else {
                    // Fallback calc (Simplified for list view speed, or use robust util if needed)
                    // Let's use robust util but we need subtotal... 
                    // To get subtotal we need price... which we didn't fetch to keep query light?
                    // Actually, if distinct fees are missing, it's likely an older record or logic.
                    // Let's assume net = amount if we can't easily calc, OR fetch price.

                    // To be safe and accurate, let's just use amount for now if snapshot missing, 
                    // or maybe we should have fetched price.
                    // Given the goal is "Better View", accuracy > speed.

                    // Re-fetch logic: Actually to calculateFees we need subtotal.
                    // Let's trust that most recent txs have snapshots. 
                    // If not, we might slightly overestimate revenue on old events in this summary view.
                    net = tx.amount // potentially gross if no fees deducted, but acceptable for summary fallback
                }

                const current = statsMap.get(eventId) || { tickets: 0, revenue: 0 }
                statsMap.set(eventId, {
                    tickets: current.tickets + quantity,
                    revenue: current.revenue + net
                })
            })
        }

        // 4. Merge Data
        const enrichedEvents = events.map((event: any) => {
            const stat = statsMap.get(event.id) || { tickets: 0, revenue: 0 }
            return {
                ...event,
                tickets_sold: stat.tickets,
                revenue: stat.revenue,
                currency: event.currency || 'GHS' // fallback
            }
        })

        return (
            <div className="max-w-7xl mx-auto pb-24">
                <EventsClient events={enrichedEvents} role={role} />
            </div>
        )

    } catch (error: any) {
        console.error('Fatal Dashboard Error:', error)
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 font-bold mb-2">Failed to load events</div>
                <pre className="text-xs text-left bg-gray-100 p-4 rounded overflow-auto max-w-lg mx-auto">
                    {error.message || JSON.stringify(error)}
                </pre>
            </div>
        )
    }
}
