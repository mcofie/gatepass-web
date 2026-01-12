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
            .select('*, ticket_tiers(quantity_sold)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })

        if (error) throw error

        // 2. Fetch Stats (Transactions)
        // We fetch all successful transactions for the org to aggregate revenue
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
                    ticket_tiers ( price ),
                    discounts ( type, value ),
                    events!inner ( fee_bearer )
                )
            `)
            .eq('status', 'success')
            .eq('reservations.events.organization_id', orgId)

        // 3. Aggregate Stats
        const statsMap = new Map<string, { revenue: number }>()

        if (transactions) {
            transactions.forEach((tx: any) => {
                const eventId = tx.reservations.event_id

                // Revenue Calculation
                // Note: Logic simplification - we trust tx.amount and subtract calculated fees
                // This aligns with dashboard net payout logic

                // Robust Net Payout Definition: Gross - All Fees
                let netPayout = 0

                // Recalc fees based on stored rates or defaults
                const platformRate = tx.applied_fee_rate ?? 0.04
                // Normalize old 2% rate to current 1.95%
                const storedProcessorRate = tx.applied_processor_rate
                const processorRate = (storedProcessorRate === 0.02 || !storedProcessorRate)
                    ? 0.0195
                    : storedProcessorRate

                // We need 'ticketRevenue' base for Platform Fee (Net of discount)
                // Since we don't have exact breakdown of multi-res here without querying all,
                // we approximate platform fee base as (Amount / (1 + processorRate))? 
                // No, safer to use stored fees if available?
                // The original code calculated calcPlatformFee from "ticketRevenue".

                // For simplified dashboard revenue, we can use:
                // Net = Amount - (Amount * ProcessorRate) - (TicketRevenue * PlatformRate)
                // But TicketRevenue is tricky without quantity.

                // However, usually PlatformFee is stored in tx.platform_fee!
                // Let's use stored fees if possible.

                let totalFees = 0
                if (tx.platform_fee !== undefined && tx.applied_processor_fee !== undefined) {
                    totalFees = tx.platform_fee + tx.applied_processor_fee
                } else {
                    // Fallback
                    const calcProcessorFee = tx.amount * processorRate
                    // Platform fee base estimate: Amount (gross)
                    // This might over-estimate platform fee if discounts exist, but good enough for list view fallback
                    const calcPlatformFee = tx.amount * platformRate
                    totalFees = calcPlatformFee + calcProcessorFee
                }

                netPayout = tx.amount - totalFees

                const current = statsMap.get(eventId) || { revenue: 0 }
                statsMap.set(eventId, {
                    revenue: current.revenue + netPayout
                })
            })
        }

        // 4. Merge Data
        const enrichedEvents = events.map((event: any) => {
            const stat = statsMap.get(event.id) || { revenue: 0 }

            // Calculate sold from tiers (Source of Truth)
            const tiers = event.ticket_tiers || []
            const totalSold = tiers.reduce((acc: number, t: any) => acc + (t.quantity_sold || 0), 0)

            return {
                ...event,
                tickets_sold: totalSold,
                revenue: stat.revenue,
                currency: event.currency || 'GHS'
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
