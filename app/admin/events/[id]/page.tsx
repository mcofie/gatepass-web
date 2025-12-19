import { createClient } from '@/utils/supabase/server'
import { EventManageClient } from '@/components/admin/EventManageClient'
import { Event, TicketTier } from '@/types/gatepass'
import { calculateFees } from '@/utils/fees'
import { getFeeSettings } from '@/utils/settings'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function AdminEventDetailPage({ params }: PageProps) {
    const supabase = await createClient()
    const { id } = await params

    // Fetch Event (Admin client/Super Admin profile allows fetching any event)
    const { data: event } = await supabase.schema('gatepass').from('events').select('*, organizers(*)').eq('id', id).single()

    // Fetch Tiers
    const { data: tiers } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', id).order('price')

    const feeSettings = await getFeeSettings()

    // Fetch Financials
    const { data: transactions } = await supabase
        .schema('gatepass')
        .from('transactions')
        .select(`
            amount,
            reservations!inner(
                quantity,
                ticket_tiers(price),
                discounts(type, value),
                events!inner(fee_bearer)
            )
        `)
        .eq('status', 'success')
        .eq('reservations.event_id', id)

    let totalRevenue = 0
    if (transactions) {
        totalRevenue = transactions.reduce((acc, tx) => {
            const r = tx.reservations as any
            const price = r.ticket_tiers?.price || 0
            const quantity = r.quantity || 1
            const feeBearer = r.events?.fee_bearer || 'customer'

            let discountAmount = 0
            const discount = Array.isArray(r.discounts) ? r.discounts[0] : r.discounts
            if (discount) {
                if (discount.type === 'percentage') {
                    discountAmount = (price * quantity) * (discount.value / 100)
                } else {
                    discountAmount = discount.value
                }
            }

            const subtotal = Math.max(0, (price * quantity) - discountAmount)
            const { organizerPayout } = calculateFees(subtotal, feeBearer, feeSettings)

            return acc + organizerPayout
        }, 0)
    }

    if (!event) return <div className="p-12 text-center text-gray-500">Event not found</div>

    return (
        <EventManageClient
            event={event as Event}
            initialTiers={(tiers as TicketTier[]) || []}
            initialTotalRevenue={totalRevenue}
            userRole="Administrator"
            feeRates={feeSettings}
            isSuperAdmin={true}
        />
    )
}
