import { createClient } from '@/utils/supabase/server'
import { PayoutsTable } from '@/components/admin/PayoutsTable'
import { getFeeSettings } from '@/utils/settings'

export default async function PayoutsPage() {
    const supabase = await createClient()

    // Fetch Events with Organizers
    const { data: events, error } = await supabase
        .schema('gatepass')
        .from('events')
        .select('id, title, status:is_published, created_at, fee_bearer, platform_fee_percent, organizers(id, name, bank_name, account_number, account_name)')
        .order('created_at', { ascending: false })

    if (error) {
        console.error("PayoutsPage Error:", error)
        return <div>Error loading events: {error.message}</div>
    }

    if (!events || events.length === 0) return <div>No events found</div>

    // Fetch Transactions for these events
    const eventIds = events.map(e => e.id)
    const { data: transactions } = await supabase
        .schema('gatepass')
        .from('transactions')
        .select(`
            amount,
            platform_fee,
            applied_processor_fee,
            reservations!inner(
                event_id,
                quantity,
                ticket_tiers(price),
                discounts(type, value)
            )
        `)
        .eq('status', 'success')
        .in('reservations.event_id', eventIds)

    // Fetch Existing Payouts
    const { data: payouts } = await supabase
        .schema('gatepass')
        .from('payouts')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })

    const feeSettings = await getFeeSettings()

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Payouts</h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage organizer balances and payouts.</p>
                </div>
            </div>

            <PayoutsTable
                events={events}
                transactions={transactions || []}
                payouts={payouts || []}
                feeSettings={feeSettings}
            />
        </div>
    )
}
