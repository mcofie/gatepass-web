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
                applied_fee_rate,
                applied_processor_rate,
                reservations!inner (
                    event_id,
                    quantity,
                    ticket_tiers ( price ),
                    discounts ( type, value ),
                    events!inner ( fee_bearer ),
                    addons
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

                // Revenue Calculation (Net Earnings - Robust Recalc)
                let netPayout = 0

                const r = tx.reservations
                const price = r.ticket_tiers?.price || 0

                // Discount
                let discountAmount = 0
                const discount = r.discounts
                // Handle array or single object if multiple discounts (usually single)
                // Note: Supabase single->array mapping depending on relationship. Usually 1:1 or 1:N.
                // Assuming 1:1 or 1:N but we take first.
                const dObj = Array.isArray(discount) ? discount[0] : discount
                if (dObj) {
                    if (dObj.type === 'percentage') {
                        discountAmount = (price * quantity) * (dObj.value / 100)
                    } else {
                        discountAmount = dObj.value
                    }
                }

                const ticketRevenue = Math.max(0, (price * quantity) - discountAmount)

                // Get Effective Rates
                const platformRate = tx.applied_fee_rate ?? 0.04
                const processorRate = tx.applied_processor_rate ?? 0.0198

                // Calculate Fees
                const calcPlatformFee = ticketRevenue * platformRate
                const calcProcessorFee = tx.amount * processorRate
                const expectedTotalFees = calcPlatformFee + calcProcessorFee

                // Net = Amount - Fees
                netPayout = tx.amount - expectedTotalFees

                const current = statsMap.get(eventId) || { tickets: 0, revenue: 0 }
                statsMap.set(eventId, {
                    tickets: current.tickets + quantity,
                    revenue: current.revenue + netPayout
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
