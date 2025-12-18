import { createClient } from '@/utils/supabase/server'
import MasterEventsTable from '@/components/admin/MasterEventsTable'

// Force dynamic fetch to ensure we see latest data (since we're admin toggling stuff)
export const revalidate = 0

export default async function MasterEventsPage() {
    const supabase = await createClient()

    const { data: events } = await supabase
        .schema('gatepass')
        .from('events')
        .select(`
            *,
            organizers(*),
            ticket_tiers(*),
            reservations(
                id,
                transactions(
                    amount,
                    status
                )
            )
        `)
        .order('created_at', { ascending: false })

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Master Event Control</h1>
                    <p className="text-gray-500 dark:text-gray-400">View and manage all events across the platform.</p>
                </div>
                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-lg text-sm font-mono text-gray-500 dark:text-gray-400">
                    {events?.length || 0} Total Events
                </div>
            </div>

            <MasterEventsTable events={events as any || []} />
        </div>
    )
}
