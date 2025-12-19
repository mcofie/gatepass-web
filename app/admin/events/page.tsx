import { createClient } from '@/utils/supabase/server'
import MasterEventsTable from '@/components/admin/MasterEventsTable'
import { getFeeSettings } from '@/utils/settings'

// Force dynamic fetch to ensure we see latest data (since we're admin toggling stuff)
export const revalidate = 0

export default async function MasterEventsPage() {
    const supabase = await createClient()

    // 1. Fetch Events
    const { data: events } = await supabase
        .schema('gatepass')
        .from('events')
        .select(`
            *,
            organizers(*),
            ticket_tiers(*)
        `)
        .order('created_at', { ascending: false })

    const feeSettings = await getFeeSettings()

    if (!events) return <div>No events found.</div>

    // 2. Fetch ALL successful transactions for these events
    // This bypasses the nested join limit issues
    const eventIds = events.map(e => e.id)
    const { data: transactions } = await supabase
        .schema('gatepass')
        .from('transactions')
        .select(`
            amount,
            reservations!inner(
                event_id,
                quantity,
                ticket_tiers(price),
                discounts(type, value)
            )
        `)
        .eq('status', 'success')
        .in('reservations.event_id', eventIds)

    // 3. Map transactions back to events for the table to consume
    const eventsWithFinancials = events.map(event => {
        const eventTransactions = transactions
            ?.filter(tx => (tx.reservations as any)?.event_id === event.id)
            ?.map(tx => ({
                amount: tx.amount,
                status: 'success',
                quantity: (tx.reservations as any)?.quantity || 1,
                price: (tx.reservations as any)?.ticket_tiers?.price || 0,
                discounts: (tx.reservations as any)?.discounts
            })) || []

        return {
            ...event,
            // We mock the nested structure expected by MasterEventsTable but with ALL transactions
            reservations: eventTransactions.length > 0 ? [{ transactions: eventTransactions }] : []
        }
    })

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Master Event Control</h1>
                    <p className="text-gray-500 dark:text-gray-400">View and manage all events across the platform.</p>
                </div>
                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-lg text-sm font-mono text-gray-500 dark:text-gray-400">
                    {events.length} Total Events
                </div>
            </div>

            <MasterEventsTable events={eventsWithFinancials as any} feeRates={feeSettings} />
        </div>
    )
}
