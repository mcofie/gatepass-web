import { createAdminClient } from '@/utils/supabase/admin'
import { PlatformPulse } from '@/components/admin/PlatformPulse'
import { formatCurrency } from '@/utils/format'
import { subDays } from 'date-fns'

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
    const supabase = createAdminClient()
    const { range = '30d' } = await searchParams

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
        .order('created_at', { ascending: false })
        .limit(50)

    const { data: recentUsers } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('id, full_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

    const { data: recentEvents } = await supabase
        .schema('gatepass')
        .from('events')
        .select('id, title, venue_name, created_at, organizers(name)')
        .order('created_at', { ascending: false })
        .limit(50)

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
        .slice(0, 50) as any[]

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">System Activity</h1>
                    <p className="text-gray-500 dark:text-gray-400">Complete log of platform events.</p>
                </div>
            </div>

            <PlatformPulse items={pulseItems} />
        </div>
    )
}


