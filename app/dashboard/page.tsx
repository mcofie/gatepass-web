import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

import { formatCurrency } from '@/utils/format'
import { Calendar, Ticket, DollarSign, AlertTriangle, ArrowRight } from 'lucide-react'

import { calculateFees } from '@/utils/fees'
import Link from 'next/link'

export const revalidate = 0

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null // handled by middleware usually

    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrgId = activeOrgId
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
            resolvedOrgId = explicitOrg.id
            if (explicitOrg.user_id === user.id) {
                resolvedOrg = explicitOrg
            } else {
                // Check team participation for this specific org
                const { data: teamMember } = await supabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('organization_id, organizers(*)')
                    .eq('organization_id', activeOrgId)
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (teamMember && teamMember.organizers) {
                    resolvedOrg = teamMember.organizers as any
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
                resolvedOrgId = teamMember.organization_id
                resolvedOrg = teamMember.organizers as any
            } else {
                resolvedOrgId = undefined
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
            resolvedOrgId = latestOrg.id
            resolvedOrg = latestOrg
        } else {
            // Latest Team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, organizers(*)')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle()

            if (teamMember && teamMember.organizers) {
                resolvedOrgId = teamMember.organization_id
                resolvedOrg = teamMember.organizers as any
            }
        }
    }

    const org = resolvedOrg

    // Fetch user profile to check for personal completeness
    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // If still no org, they need to onboard
    if (!org) {
        // We'll let the UI handle empty state or redirect, but for stats we return zeros
        // Ideally checking "redirect" here but safe to just return empty stats
        // Actually, let's return early structure to avoid crashes
        return (
            <div className="max-w-7xl mx-auto py-12 text-center">
                <h2 className="text-2xl font-bold">No Organization Found</h2>
                <p className="mb-4">Please create an organization to get started.</p>
                <a href="/onboarding" className="text-blue-600 hover:underline">Go to Onboarding</a>
            </div>
        )
    }

    // Check for missing details
    const missingOrg = !org.logo_url || !org.description || !org.paystack_subaccount_code
    const missingProfile = !profile?.full_name || !profile?.username || !profile?.phone_number
    const needsSetup = missingOrg || missingProfile

    // Check for settlement status
    const needsSettlement = org ? !org.paystack_subaccount_code : false

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
            recentSalesRes.data.forEach((sale: any) => {
                const addons = sale.reservations?.addons
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
                    addonsData.forEach((a: any) => {
                        addonMap[a.id] = a.name
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
        transRes.data.forEach((tx: any) => {
            if (tx.currency) currencySymbol = tx.currency

            const finalPlatformFee = tx.platform_fee ?? 0
            const finalProcessorFee = tx.applied_processor_fee ?? 0

            // Total Payout = Amount - Fees
            const netPayout = tx.amount - finalPlatformFee - finalProcessorFee
            totalRevenue += netPayout
        })
    }


    const stats = [
        { label: 'Total Events', value: eventRes.count || 0, icon: Calendar },
        { label: 'Tickets Sold', value: ticketRes.count || 0, icon: Ticket },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue, currencySymbol), icon: DollarSign },
    ]

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">

            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
                <p className="text-gray-500 font-medium dark:text-gray-400">Welcome back, here's what's happening today.</p>
            </div>

            {/* Stats Grid - Bento Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={stat.label} className="group bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 text-gray-400 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors flex items-center justify-center">
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">



                    {/* Recent Sales */}
                    <div>
                        <div className="flex items-center justify-between px-1 mb-4">
                            <h3 className="font-bold text-xl tracking-tight dark:text-white">Recent Sales</h3>
                            <a href="/dashboard/sales" className="text-sm font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors">View All</a>
                        </div>

                        <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                            {recentSalesRes.data && recentSalesRes.data.length > 0 ? (
                                <div className="divide-y divide-gray-50 dark:divide-white/5">
                                    {recentSalesRes.data.map((sale: any) => {
                                        // Calculations
                                        // Simplified Logic: Rely on stored snapshot
                                        const pFee = sale.platform_fee ?? 0
                                        const procFee = sale.applied_processor_fee ?? 0

                                        const organizerPayout = sale.amount - pFee - procFee

                                        return (
                                            <div key={sale.id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 text-gray-600 dark:text-white flex items-center justify-center font-bold text-sm shadow-inner">
                                                        {sale.reservations?.profiles?.full_name?.charAt(0) || sale.reservations?.guest_name?.charAt(0) || 'G'}
                                                    </div>
                                                    <div>
                                                        <p className="text-[15px] font-semibold text-gray-900 dark:text-white group-hover:text-black dark:group-hover:text-white transition-colors">
                                                            {sale.reservations?.profiles?.full_name || sale.reservations?.guest_name || 'Guest User'}
                                                        </p>
                                                        <p className="text-[13px] text-gray-500 dark:text-gray-400">
                                                            purchased <span className="font-medium text-gray-700 dark:text-gray-300">{sale.reservations?.ticket_tiers?.name}</span> • {sale.reservations?.events?.title}
                                                        </p>
                                                        {sale.reservations?.addons && Object.keys(sale.reservations.addons).length > 0 && (
                                                            <div className="mt-1 flex flex-col gap-0.5">
                                                                {Object.entries(sale.reservations.addons).map(([id, qty]) => (
                                                                    <p key={id} className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                                                                        <span className="bg-gray-100 dark:bg-white/10 px-1.5 rounded text-[10px]">{qty as number}x</span> {addonMap[id] || 'Add-on'}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[15px] font-bold text-green-600 dark:text-green-400 tabular-nums">+{formatCurrency(organizerPayout, sale.currency)}</p>
                                                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                                                        Net Earnings
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="py-24 text-center text-gray-400">
                                    <p className="text-sm font-medium">No recent activity found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions (Sidebar) */}
                <div className="space-y-6">
                    <div className="bg-black dark:bg-[#111] text-white rounded-3xl p-8 shadow-2xl shadow-black/20 dark:shadow-none border border-transparent dark:border-white/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-white/10 transition-colors duration-500" />
                        <div className="relative z-10">
                            <h3 className="font-bold text-2xl mb-2">Create Event</h3>
                            <p className="text-gray-400 mb-8 max-w-[200px] leading-relaxed">Ready to launch your next experience?</p>
                            <a href="/dashboard/events/create" className="inline-flex items-center justify-center w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98]">
                                Get Started
                            </a>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] p-8">
                        <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Quick Links</h3>
                        <div className="space-y-2">
                            <a href="/dashboard/events" className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 group-hover:bg-white dark:group-hover:bg-transparent group-hover:shadow-sm dark:group-hover:shadow-none border border-transparent group-hover:border-gray-200 dark:group-hover:border-white/10 flex items-center justify-center transition-all">
                                    <Calendar className="w-5 h-5 text-gray-500 group-hover:text-black dark:text-gray-400 dark:group-hover:text-white" />
                                </div>
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white">Manage Events</span>
                            </a>
                            <a href="/dashboard/settings" className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 group-hover:bg-white dark:group-hover:bg-transparent group-hover:shadow-sm dark:group-hover:shadow-none border border-transparent group-hover:border-gray-200 dark:group-hover:border-white/10 flex items-center justify-center transition-all">
                                    <Ticket className="w-5 h-5 text-gray-500 group-hover:text-black dark:text-gray-400 dark:group-hover:text-white" />
                                </div>
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white">Settings</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}
