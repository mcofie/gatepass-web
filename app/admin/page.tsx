import { createClient } from '@/utils/supabase/server'
import { Banknote, Calendar, Users, Activity } from 'lucide-react'
import { PlatformPulse } from '@/components/admin/PlatformPulse'
import { DashboardChart } from '@/components/admin/DashboardChart'
import { DashboardFilter } from '@/components/admin/DashboardFilter'
import { formatCurrency } from '@/utils/format'
import { format, subDays, isSameDay, subMonths, startOfDay } from 'date-fns'

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
    const supabase = await createClient()
    const { range = '30d' } = await searchParams

    // Determine Date Range
    let startDate: Date | null = subDays(new Date(), 30) // Default 30d
    let daysToRender = 30

    if (range === '7d') {
        startDate = subDays(new Date(), 7)
        daysToRender = 7
    } else if (range === '90d') {
        startDate = subDays(new Date(), 90)
        daysToRender = 90
    } else if (range === 'all') {
        startDate = null
        daysToRender = 30 // Fallback for chart viz if all time, or maybe handle differently. For now let's just show last 30 of all time if 'all', or maybe we can't chart 'all' easily without aggregation. Let's cap chart to 30 days for visual sanity even if 'all' is selected for totals.
    }

    // 1. Transactions & Revenue
    let query = supabase
        .schema('gatepass')
        .from('transactions')
        .select('amount, created_at')
        .eq('status', 'success')

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
    }

    const { data: transactions } = await query

    const totalRevenue = transactions?.reduce((acc, tx) => acc + (tx.amount || 0), 0) || 0
    const estimatedFees = totalRevenue * 0.05

    // Prepare Chart Data
    // We render the number of days selected, or last 30 if 'all'
    const chartData = Array.from({ length: daysToRender }).map((_, i) => {
        const date = subDays(new Date(), (daysToRender - 1) - i)
        const dayTotal = transactions?.reduce((acc, tx) => {
            if (isSameDay(new Date(tx.created_at), date)) {
                return acc + (tx.amount || 0)
            }
            return acc
        }, 0) || 0

        return {
            date: format(date, 'MMM dd'),
            revenue: dayTotal
        }
    })

    // 2. Active Events (Snapshot - Always Total Active)
    const { count: activeEvents } = await supabase
        .schema('gatepass')
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true)

    // 3. New Users (In Range) or Total Users (if All)
    let userQuery = supabase
        .schema('gatepass')
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    if (startDate) {
        userQuery = userQuery.gte('created_at', startDate.toISOString())
    }

    // Fallback: Get TOTAL for context if we want, but let's stick to the requested filter behavior.
    // If filtering, "Users" card implies "New Users in Period".
    const { count: userCount } = await userQuery

    // --- PULSE DATA FETCHING ---
    const { data: recentSales } = await supabase
        .schema('gatepass')
        .from('transactions')
        .select(`
            id, amount, currency, created_at,
            reservations ( 
                guest_name, 
                profiles ( full_name ),
                events ( title )
            )
        `)
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(5)

    const { data: recentUsers } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('id, full_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

    const { data: recentEvents } = await supabase
        .schema('gatepass')
        .from('events')
        .select('id, title, venue_name, created_at, organizers(name)')
        .order('created_at', { ascending: false })
        .limit(5)

    // Merge & Format
    const pulseItems = [
        ...(recentSales?.map(s => ({
            id: s.id,
            type: 'sale',
            title: `New Sale: ${formatCurrency(s.amount, s.currency)}`,
            subtitle: `${(s.reservations as any)?.profiles?.full_name || (s.reservations as any)?.guest_name || 'Guest'} bought ${(s.reservations as any)?.events?.title || 'Unknown Event'} tix`,
            timestamp: s.created_at
        })) || []),
        ...(recentUsers?.map(u => ({
            id: u.id,
            type: 'user',
            title: `New User: ${u.full_name || 'No Name'} `,
            subtitle: u.email,
            timestamp: u.created_at
        })) || []),
        ...(recentEvents?.map(e => ({
            id: e.id,
            type: 'event',
            title: `Event Created: ${e.title} `,
            subtitle: `By ${(e.organizers as any)?.name || 'Unknown'} at ${e.venue_name} `,
            timestamp: e.created_at
        })) || [])
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10) as any[]

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Overview</h1>
                    <p className="text-gray-500 dark:text-gray-400">System-wide performance metrics.</p>
                </div>
                <DashboardFilter />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={range === 'all' ? "Total Revenue" : "Revenue"}
                    value={totalRevenue}
                    currency="GHS"
                    icon={Banknote}
                    color="text-green-400"
                    subtitle={range !== 'all' ? `Last ${daysToRender} days` : 'All time'}
                    trend={12.5}
                />
                <StatCard
                    title="Platform Fees"
                    value={estimatedFees}
                    currency="GHS"
                    icon={Activity}
                    color="text-purple-400"
                    subtitle={range !== 'all' ? `Est. (5%)` : 'All time'}
                    trend={8.2}
                />
                <StatCard
                    title="Active Events"
                    value={activeEvents || 0}
                    icon={Calendar}
                    color="text-blue-400"
                    subtitle="Currently Live"
                    trend={-2.4}
                />
                <StatCard
                    title={range === 'all' ? "Total Users" : "New Users"}
                    value={userCount || 0}
                    icon={Users}
                    color="text-orange-400"
                    subtitle={range !== 'all' ? `Last ${daysToRender} days` : 'All time'}
                    trend={24.1}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    <DashboardChart data={chartData} />
                </div>

                {/* Side Feed */}
                <div>
                    <PlatformPulse items={pulseItems} />
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, currency, icon: Icon, color, subtitle, trend }: any) {
    const formatter = new Intl.NumberFormat('en-GH', {
        style: currency ? 'currency' : 'decimal',
        currency: currency || 'GHS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })

    const isPositive = trend > 0
    const isNegative = trend < 0

    return (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all group shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                <div className={`p-2 rounded-lg bg-gray-50 dark:bg-white/5 group-hover:bg-gray-100 dark:group-hover:bg-white/10 transition-colors ${color}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {formatter.format(value)}
                </p>
                {trend !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isPositive ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                        isNegative ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                            'bg-gray-500/10 text-gray-500'
                        }`}>
                        {isPositive ? '↑' : isNegative ? '↓' : '•'} {Math.abs(trend)}%
                    </span>
                )}
            </div>

            {subtitle && (
                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-2 font-medium tracking-wide uppercase">{subtitle}</p>
            )}
        </div>
    )
}
