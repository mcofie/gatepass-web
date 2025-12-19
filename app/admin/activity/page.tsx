import { createAdminClient } from '@/utils/supabase/admin'
import { PlatformPulse, PulseItem } from '@/components/admin/PlatformPulse'
import { formatCurrency } from '@/utils/format'
import { subDays } from 'date-fns'
import Link from 'next/link'

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ range?: string, page?: string }> }) {
    const supabase = createAdminClient()
    const { range = '30d', page = '1' } = await searchParams
    const currentPage = parseInt(page, 10) || 1
    const PER_PAGE = 25

    // We must fetch enough data from EACH source to guarantee that when merged and sorted,
    // the top (page * PER_PAGE) items are accurate.
    // e.g. Page 2 (items 25-50): We need top 50 from Sales, top 50 from Users, etc.
    // because it's possible ALL top 50 global items came from Sales.
    const fetchLimit = currentPage * PER_PAGE + 10 // +10 buffer

    // Determine Date Range
    // --- PULSE DATA FETCHING (Expanded for Activity Page) ---
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
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(fetchLimit)

    const { data: recentUsers } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('id, full_name, email, created_at')
        .select('id, full_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(fetchLimit)

    const { data: recentEvents } = await supabase
        .schema('gatepass')
        .from('events')
        .select('id, title, venue_name, created_at, organizers(name)')
        .order('created_at', { ascending: false })
        .limit(fetchLimit)

    // Audit Logs
    const { data: logs } = await supabase
        .schema('gatepass')
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(fetchLimit)

    // Fetch Log Actors
    let actors: Record<string, any> = {}
    if (logs && logs.length > 0) {
        const actorIds = Array.from(new Set(logs.map(l => l.actor_id)))
        const { data: actorProfiles } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('id, full_name, email')
            .in('id', actorIds)

        if (actorProfiles) {
            actorProfiles.forEach(p => actors[p.id] = p)
        }
    }

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
        })) || []),
        ...(logs?.map(l => {
            const actor = actors[l.actor_id]
            const name = actor?.full_name || actor?.email || 'System'
            const meta = l.metadata as any
            let details = ''
            if (meta?.new_fee) details = `New Fee: ${(meta.new_fee * 100).toFixed(2)}%`

            return {
                id: l.id,
                type: 'admin_log',
                title: `Admin Action: ${l.action.replace(/_/g, ' ').toUpperCase()}`,
                subtitle: `${name} - Target: ${l.target_type} ${details ? `(${details})` : ''}`,
                timestamp: l.created_at
            }
        }) || [])
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) as PulseItem[]

    // Slice for current view
    const visibleItems = pulseItems.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
    const hasNextPage = pulseItems.length > currentPage * PER_PAGE

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">System Activity</h1>
                    <p className="text-gray-500 dark:text-gray-400">Complete log of platform events.</p>
                </div>
            </div>

            <PlatformPulse items={visibleItems} />

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10">
                <Link
                    href={`/admin/activity?page=${Math.max(1, currentPage - 1)}`}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentPage === 1
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                    aria-disabled={currentPage === 1}
                >
                    Previous
                </Link>
                <div className="text-sm font-medium text-gray-500">
                    Page {currentPage}
                </div>
                <Link
                    href={`/admin/activity?page=${currentPage + 1}`}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${!hasNextPage
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                    aria-disabled={!hasNextPage}
                >
                    Next
                </Link>
            </div>
        </div>
    )
}


