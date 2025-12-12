import { createClient } from '@/utils/supabase/server'
import { Calendar, Ticket, DollarSign } from 'lucide-react'

export const revalidate = 0

export default async function DashboardPage() {
    const supabase = await createClient()

    // Parallel fetch
    const [eventRes, ticketRes] = await Promise.all([
        supabase.schema('gatepass').from('events').select('*', { count: 'exact', head: true }),
        supabase.schema('gatepass').from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'valid')
    ])

    const stats = [
        { label: 'Total Events', value: eventRes.count || 0, icon: Calendar },
        { label: 'Tickets Sold', value: ticketRes.count || 0, icon: Ticket },
        { label: 'Total Revenue', value: 'GHS 0.00', icon: DollarSign }, // Placeholder
    ]

    return (
        <div>
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

            <div className="bg-white p-8 rounded-xl border shadow-sm min-h-[300px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="mb-2">Activity Chart</p>
                    <p className="text-xs">Coming soon</p>
                </div>
            </div>
        </div>
    )
}
