import { createClient } from '@/utils/supabase/server'
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
        <div className="max-w-6xl">
            <h1 className="text-2xl font-bold mb-6">Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-xl border flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                            <p className="text-xl font-bold">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Activity Feed */}
                <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
                    <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {recentSalesRes.data && recentSalesRes.data.length > 0 ? (
                            recentSalesRes.data.map((sale: any) => (
                                <div key={sale.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">
                                            {sale.profiles?.full_name?.charAt(0) || 'G'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {sale.profiles?.full_name || 'Guest User'} <span className="font-normal text-gray-500">bought</span> {sale.ticket_tiers?.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                for {sale.ticket_tiers?.events?.title}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold">{sale.ticket_tiers?.currency} {sale.ticket_tiers?.price}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(sale.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center text-gray-400 text-sm">
                                <p>No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions (Placeholder for now, can be expanded) */}
                <div className="space-y-6">
                    <div className="bg-black text-white rounded-xl p-6 shadow-lg">
                        <h3 className="font-bold text-lg mb-2">Create New Event</h3>
                        <p className="text-sm text-gray-300 mb-6">Launch your next experience.</p>
                        <a href="/dashboard/events/create" className="block w-full bg-white text-black text-center py-2.5 rounded-lg font-bold hover:bg-gray-100 transition">
                            Create Event
                        </a>
                    </div>

                    <div className="bg-white rounded-xl border shadow-sm p-6">
                        <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-4">Quick Links</h3>
                        <div className="space-y-3">
                            <a href="/dashboard/events" className="flex items-center gap-3 text-sm font-medium hover:text-black transition">
                                <span className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center"><Calendar className="w-4 h-4" /></span>
                                Manage Events
                            </a>
                            <a href="/dashboard/settings" className="flex items-center gap-3 text-sm font-medium hover:text-black transition">
                                <span className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center"><Ticket className="w-4 h-4" /></span>
                                Settings
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
