import { createClient } from '@/utils/supabase/server'

import { formatCurrency } from '@/utils/format'
import { Calendar, Ticket, DollarSign } from 'lucide-react'

export const revalidate = 0

export default async function DashboardPage() {
    const supabase = await createClient()

    // Parallel fetch for stats and activity
    const [eventRes, ticketRes, recentSalesRes] = await Promise.all([
        supabase.schema('gatepass').from('events').select('*', { count: 'exact', head: true }),
        // Fetch all valid/used tickets with their tier price
        supabase.schema('gatepass')
            .from('tickets')
            .select(`
                status,
                ticket_tiers ( price, currency )
            `)
            .in('status', ['valid', 'used']),

        // Fetch recent 5 sales
        supabase.schema('gatepass')
            .from('tickets') // TODO: Fix recent activty
            .select(`
                id,
                created_at,
                status,
                profiles ( full_name, email ),
                ticket_tiers ( name, price, currency, events ( title ) )
            `)
            .order('created_at', { ascending: false })
            .limit(5)
    ])

    // Calculate Revenue
    let totalRevenue = 0
    let currencySymbol = 'GHS'

    if (ticketRes.data) {
        ticketRes.data.forEach((t: any) => {
            if (t.ticket_tiers) {
                totalRevenue += t.ticket_tiers.price
                currencySymbol = t.ticket_tiers.currency // Assumption: Single currency for now
            }
        })
    }

    const stats = [
        { label: 'Total Events', value: eventRes.count || 0, icon: Calendar },
        { label: 'Tickets Sold', value: ticketRes.data?.length || 0, icon: Ticket },
        { label: 'Total Revenue', value: `${currencySymbol} ${totalRevenue.toLocaleString()}`, icon: DollarSign },
    ]

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                <p className="text-gray-500 font-medium">Welcome back, here's what's happening today.</p>
            </div>

            {/* Stats Grid - Bento Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={stat.label} className="group bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                            <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 group-hover:bg-black group-hover:text-white transition-colors flex items-center justify-center">
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-4xl font-bold tracking-tight text-gray-900">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Activity Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-xl tracking-tight">Recent Activity</h3>
                        <a href="/dashboard/events" className="text-sm font-medium text-gray-400 hover:text-black transition-colors">View All</a>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                        {recentSalesRes.data && recentSalesRes.data.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {recentSalesRes.data.map((sale: any) => (
                                    <div key={sale.id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors group">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm shadow-inner">
                                                {sale.profiles?.full_name?.charAt(0) || 'G'}
                                            </div>
                                            <div>
                                                <p className="text-[15px] font-semibold text-gray-900 group-hover:text-black transition-colors">
                                                    {sale.profiles?.full_name || 'Guest User'}
                                                </p>
                                                <p className="text-[13px] text-gray-500">
                                                    purchased <span className="font-medium text-gray-700">{sale.ticket_tiers?.name}</span> • {sale.ticket_tiers?.events?.title}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[15px] font-bold text-black tabular-nums">{formatCurrency(sale.ticket_tiers?.price || 0, sale.ticket_tiers?.currency)}</p>
                                            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                                                {new Date(sale.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center text-gray-400">
                                <p className="text-sm font-medium">No recent activity found.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <div className="bg-black text-white rounded-3xl p-8 shadow-2xl shadow-black/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-white/10 transition-colors duration-500" />
                        <div className="relative z-10">
                            <h3 className="font-bold text-2xl mb-2">Create Event</h3>
                            <p className="text-gray-400 mb-8 max-w-[200px] leading-relaxed">Ready to launch your next experience?</p>
                            <a href="/dashboard/events/create" className="inline-flex items-center justify-center w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98]">
                                Get Started
                            </a>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] p-8">
                        <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Quick Links</h3>
                        <div className="space-y-2">
                            <a href="/dashboard/events" className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-gray-200 flex items-center justify-center transition-all">
                                    <Calendar className="w-5 h-5 text-gray-500 group-hover:text-black" />
                                </div>
                                <span className="text-sm font-semibold text-gray-600 group-hover:text-black">Manage Events</span>
                            </a>
                            <a href="/dashboard/settings" className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-gray-200 flex items-center justify-center transition-all">
                                    <Ticket className="w-5 h-5 text-gray-500 group-hover:text-black" />
                                </div>
                                <span className="text-sm font-semibold text-gray-600 group-hover:text-black">Settings</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
