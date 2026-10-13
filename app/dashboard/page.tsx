import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

import { formatCurrency } from '@/utils/format'
import { ArrowUpRight, Plus, Ticket } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 0

interface TeamMemberRecord {
    organization_id: string
    organization: Record<string, unknown> | null
}

interface TransactionRecord {
    id: string
    created_at: string
    amount: number
    currency: string
    platform_fee?: number
    applied_processor_fee?: number
    applied_fee_rate?: number
    applied_processor_rate?: number
    metadata?: {
        payment_type?: string
        metadata?: { payment_type?: string }
    } | null
    reservations?: {
        quantity: number
        guest_name?: string
        guest_email?: string
        profiles?: { full_name?: string; email?: string }
        ticket_tiers?: { name?: string; price?: number }
        events?: { title?: string; organization_id?: string; fee_bearer?: string }
        discounts?: { type?: string; value?: number }
        addons?: Record<string, number>
    } | null
}

interface AddonRecord {
    id: string
    name: string
}

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null // handled by middleware usually

    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrg = null

    // 1. Determine Organization Context
    if (activeOrgId) {
        // Try finding as owner first
        const { data: explicitOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('*')
            .eq('id', activeOrgId)
            .maybeSingle()

        if (explicitOrg) {

            if (explicitOrg.user_id === user.id) {
                resolvedOrg = explicitOrg
            } else {
                // Check team participation for this specific org
                const { data: teamMember } = await supabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('organization_id, organization:organizers(*)')
                    .eq('organization_id', activeOrgId)
                    .eq('user_id', user.id)
                    .maybeSingle()

                const tm = teamMember as unknown as TeamMemberRecord
                if (tm && tm.organization) {
                    resolvedOrg = tm.organization
                }
            }
        } else {
            // Check if user is part of this org team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, organizers(*)')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (teamMember && teamMember.organizers) {

                resolvedOrg = teamMember.organizers as unknown as Record<string, unknown>
            } else {

            }
        }
    }

    // Fallback: Default logic (Latest Owner -> Latest Team)
    if (!resolvedOrg) {
        // Latest Owned
        const { data: latestOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latestOrg) {

            resolvedOrg = latestOrg
        } else {
            // Latest Team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, organization:organizers(*)')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle()

            const tm = teamMember as unknown as TeamMemberRecord
            if (tm && tm.organization) {
                resolvedOrg = tm.organization
            } else if (user.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                // Secondary fallback: Try as admin by email (bypasses RLS)
                const { createClient: createAdminClient } = await import('@supabase/supabase-js')
                const adminSupabase = createAdminClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                )

                const { data: inviteByEmail } = await adminSupabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('organization_id, organization:organizers(*)')
                    .ilike('email', user.email)
                    .limit(1)
                    .maybeSingle()

                const inv = inviteByEmail as unknown as TeamMemberRecord
                if (inv && inv.organization) {
                    resolvedOrg = inv.organization

                    // Trigger sync synchronously
                    const { syncUserTeamMemberships } = await import('@/app/actions/team')
                    await syncUserTeamMemberships()
                }
            }
        }
    }

    const org = resolvedOrg



    // If still no org, they need to onboard
    if (!org) {
        // We'll let the UI handle empty state or redirect, but for stats we return zeros
        // Ideally checking "redirect" here but safe to just return empty stats
        // Actually, let's return early structure to avoid crashes
        return (
            <div className="mx-auto max-w-3xl py-20 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Creator workspace</p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Create your organization</h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">Set up your workspace to publish events and follow your sales in one place.</p>
                <Link href="/onboarding" className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-black px-6 text-sm font-semibold text-white dark:bg-white dark:text-black">Get started <ArrowUpRight className="size-4" /></Link>
            </div>
        )
    }



    const orgId = org.id

    // Fetches for stats
    const [eventRes, ticketRes, recentSalesRes, transRes] = await Promise.all([
        supabase
            .schema('gatepass')
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId),

        // Count sold tickets
        supabase.schema('gatepass')
            .from('tickets')
            .select(`
                id,
                ticket_tiers!inner ( 
                    events!inner ( organization_id )
                )
            `, { count: 'exact', head: true })
            .eq('ticket_tiers.events.organization_id', orgId)
            .in('status', ['valid', 'used']),

        // Recent sales (Transactions)
        supabase.schema('gatepass')
            .from('transactions')
            .select(`
                id,
                created_at,
                amount,
                currency,
                platform_fee,
                applied_processor_fee,
                applied_fee_rate,
                applied_processor_rate,
                metadata,
                reservations!inner (
                    quantity,
                    guest_name,
                    guest_email,
                    profiles ( full_name, email ),
                    ticket_tiers ( name, price ),
                    events!inner ( title, organization_id, fee_bearer ),
                    discounts ( type, value ),
                    addons
                )
            `)
            .eq('status', 'success')
            .eq('reservations.events.organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5),

        // Calculate Revenue from Transactions (The Fix)
        supabase.schema('gatepass')
            .from('transactions')
            .select(`
                amount,
                currency,
                platform_fee,
                applied_processor_fee,
                applied_fee_rate,
                applied_processor_rate,
                metadata,
                reservations!inner (
                    quantity,
                    ticket_tiers(price),
                    discounts(type, value),
                    events!inner ( organization_id, fee_bearer )
                )
            `)
            .eq('status', 'success')
            .eq('reservations.events.organization_id', orgId)
    ])

    // Fetch Addon Names for Recent Sales
    const addonMap: Record<string, string> = {}
    try {
        if (recentSalesRes.data && recentSalesRes.data.length > 0) {
            const addonIds = new Set<string>()
            recentSalesRes.data.forEach((sale: unknown) => {
                const s = sale as TransactionRecord
                const addons = s.reservations?.addons
                if (addons && typeof addons === 'object') {
                    Object.keys(addons).forEach(id => addonIds.add(id))
                }
            })

            if (addonIds.size > 0) {
                const { data: addonsData } = await supabase
                    .schema('gatepass')
                    .from('event_addons')
                    .select('id, name')
                    .in('id', Array.from(addonIds))

                if (addonsData) {
                    addonsData.forEach((a: unknown) => {
                        const addon = a as AddonRecord
                        addonMap[addon.id] = addon.name
                    })
                }
            }
        }
    } catch (e) {
        console.error('Dashboard Addon Fetch Error:', e)
    }

    // Calculate Revenue
    let totalRevenue = 0
    let currencySymbol = 'GHS' // Default fallback

    if (transRes.data) {
        // Sum actual transaction amounts - Updated to Strict Net Payout
        transRes.data.forEach((tx: unknown) => {
            const t = tx as TransactionRecord
            if (t.currency) currencySymbol = t.currency

            const feeBearer = t.reservations?.events?.fee_bearer || 'customer'
            const isInstalment = t.metadata?.payment_type === 'instalment' || t.metadata?.metadata?.payment_type === 'instalment'

            // Calculate Ticket Subtotal (Revenue from tickets)
            // We need to parse reservations to get accurate fee basis
            let ticketRevenue = 0
            if (t.reservations) {
                const r = t.reservations
                const discount = r.discounts
                let discountAmount = 0
                const price = r.ticket_tiers?.price || 0
                const quantity = r.quantity || 1

                if (discount) {
                    if (discount.type === 'percentage') {
                        discountAmount = (price * quantity) * ((discount.value || 0) / 100)
                    } else {
                        discountAmount = discount.value || 0
                    }
                }
                ticketRevenue = Math.max(0, (price * quantity) - discountAmount)
            }

            // Get Rates
            // Use stored rates on transaction if available, otherwise fallback to defaults (4% / 1.95%)
            const platformRate = t.applied_fee_rate ?? 0.04
            // Normalize old 2% rate to current 1.95%
            const storedProcessorRate = t.applied_processor_rate
            const processorRate = (storedProcessorRate === 0.02 || storedProcessorRate == null)
                ? 0.0195
                : storedProcessorRate

            // Recalculate Fees based on correct basis
            let finalPlatformFee = t.platform_fee
            if (finalPlatformFee == null || finalPlatformFee === 0) {
                finalPlatformFee = isInstalment
                    ? t.amount * platformRate
                    : ticketRevenue * platformRate
            }

            const finalProcessorFee = (t.applied_processor_fee != null)
                ? t.applied_processor_fee
                : t.amount * processorRate

            // Net Payout = Total Paid - Total Fees
            const netPayout = feeBearer === 'customer'
                ? t.amount - finalPlatformFee
                : t.amount - finalPlatformFee - finalProcessorFee

            totalRevenue += netPayout
        })
    }


    const stats = [
        { label: 'Events', value: eventRes.count ?? 0, note: 'Created' },
        { label: 'Tickets sold', value: ticketRes.count ?? 0, note: 'Valid and used' },
        { label: 'Net earnings', value: formatCurrency(totalRevenue, currencySymbol), note: 'After applicable fees' },
    ]

    const recentSales = (recentSalesRes.data || []) as unknown as TransactionRecord[]
    const organizationName = typeof org.name === 'string' ? org.name : 'Your organization'

    return (
        <div className="mx-auto max-w-[1180px] pb-16">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace overview</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-gray-950 dark:text-white sm:text-[38px]">{organizationName}</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Your events and sales at a glance.</p>
                </div>
                <Link href="/dashboard/events/create" className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                    <Plus className="size-4" aria-hidden="true" /> Create event
                </Link>
            </div>

            <section aria-label="All-time performance" className="mt-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/15 dark:bg-[#101010] sm:grid-cols-3">
                {stats.map((stat, index) => (
                    <div key={stat.label} className={"min-w-0 px-5 py-4 sm:px-6 sm:py-6 " + (index === 1 ? "border-l border-gray-200 dark:border-white/15" : index === 2 ? "col-span-2 border-t border-gray-200 dark:border-white/15 sm:col-span-1 sm:border-l sm:border-t-0" : "")}>
                        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                        <p className="mt-3 truncate text-[30px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-gray-950 dark:text-white sm:text-[34px]">{stat.value}</p>
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{stat.note}</p>
                    </div>
                ))}
            </section>

            <section className="mt-11" aria-labelledby="recent-sales-title">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                        <h2 id="recent-sales-title" className="text-xl font-semibold tracking-[-0.025em] text-gray-950 dark:text-white">Recent sales</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Latest successful payments</p>
                    </div>
                    <Link href="/dashboard/sales" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gray-600 transition-colors hover:text-black dark:text-gray-300 dark:hover:text-white">View all <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/15 dark:bg-[#101010]">
                    {recentSales.length > 0 ? (
                        <div>
                            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px] gap-5 border-b border-gray-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:border-white/10 sm:grid">
                                <span>Customer</span><span>Event</span><span className="text-right">Net earnings</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-white/10">
                                {recentSales.map(s => {
                                    const reservation = s.reservations
                                    const feeBearer = reservation?.events?.fee_bearer || 'customer'
                                    const isInstalment = s.metadata?.payment_type === 'instalment' || s.metadata?.metadata?.payment_type === 'instalment'
                                    const price = reservation?.ticket_tiers?.price || 0
                                    const quantity = reservation?.quantity || 1
                                    const discount = reservation?.discounts
                                    const discountAmount = discount?.type === 'percentage'
                                        ? price * quantity * ((discount.value || 0) / 100)
                                        : discount?.value || 0
                                    const ticketRevenue = Math.max(0, price * quantity - discountAmount)
                                    const platformRate = s.applied_fee_rate ?? 0.04
                                    const storedProcessorRate = s.applied_processor_rate
                                    const processorRate = (storedProcessorRate === 0.02 || storedProcessorRate == null) ? 0.0195 : storedProcessorRate
                                    let platformFee = s.platform_fee
                                    if (platformFee == null || platformFee === 0) platformFee = isInstalment ? s.amount * platformRate : ticketRevenue * platformRate
                                    const processorFee = s.applied_processor_fee != null ? s.applied_processor_fee : s.amount * processorRate
                                    const payout = feeBearer === 'customer'
                                        ? s.amount - platformFee
                                        : s.amount - platformFee - processorFee
                                    const buyer = reservation?.profiles?.full_name || reservation?.guest_name || 'Guest'
                                    const eventTitle = reservation?.events?.title || 'Event'
                                    const tierName = reservation?.ticket_tiers?.name || 'Ticket'
                                    const saleDate = new Date(s.created_at)
                                    const dateLabel = Number.isNaN(saleDate.getTime())
                                        ? ''
                                        : new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short' }).format(saleDate)

                                    return (
                                        <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px] sm:gap-5 sm:px-6">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{buyer}</p>
                                                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{tierName}<span className="sm:hidden"> · {eventTitle}</span></p>
                                                {reservation?.addons && Object.keys(reservation.addons).length > 0 && (
                                                    <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                                                        {Object.entries(reservation.addons).map(([id, qty]) => String(qty) + '× ' + (addonMap[id] || 'Add-on')).join(' · ')}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="hidden truncate text-sm text-gray-600 dark:text-gray-300 sm:block">{eventTitle}</p>
                                            <div className="text-right">
                                                <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(payout, s.currency)}</p>
                                                {dateLabel && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{dateLabel}</p>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <div className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"><Ticket className="size-5" aria-hidden="true" /></div>
                            <h3 className="mt-4 text-base font-semibold text-gray-950 dark:text-white">No sales yet</h3>
                            <p className="mt-1 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">When someone buys a ticket, the sale will appear here.</p>
                            <Link href="/dashboard/events" className="mt-4 text-sm font-semibold underline underline-offset-4">View events</Link>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
