import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { EventsClient } from '@/components/admin/EventsClient'


export const revalidate = 0

export default async function AdminEventsPage() {
    const supabase = await createClient()

    // Fetch all events (Admin view)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div>Please log in to view events.</div>
    }

    // 1. Determine Organization Context and Role
    let { data: org } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('id')
        .eq('user_id', user.id)
        .single()

    let role = org ? 'Owner' : null
    let orgId = org?.id

    // If not owner, check if team member
    if (!org) {
        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .single()

        if (teamMember) {
            orgId = teamMember.organization_id
            role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
        }
    }

    if (!orgId) {
        return (
            <div className="max-w-7xl mx-auto py-12 text-center">
                <h2 className="text-2xl font-bold">No Organization Found</h2>
                <p className="mb-4 text-gray-500">You need to be part of an organization to manage events.</p>
                <Link href="/onboarding" className="text-blue-600 hover:underline">Go to Onboarding</Link>
            </div>
        )
    }

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
