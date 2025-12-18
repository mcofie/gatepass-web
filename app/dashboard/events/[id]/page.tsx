import { createClient } from '@/utils/supabase/server'
import { EventManageClient } from '@/components/admin/EventManageClient'
import { Event, TicketTier } from '@/types/gatepass'
import { calculateFees } from '@/utils/fees'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ManageEventPage({ params }: PageProps) {
    const supabase = await createClient()
    const { id } = await params

    // Fetch Event
    const { data: event } = await supabase.schema('gatepass').from('events').select('*').eq('id', id).single()

    // Fetch Tiers
    const { data: tiers } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', id).order('price')

    // Calculate Total Realized Revenue (Server Side) with Strict Net Logic
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

            // Discount
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
            const { organizerPayout } = calculateFees(subtotal, feeBearer)

            return acc + organizerPayout // Summing net payouts
        }, 0)
    }

    if (!event) return <div>Event not found</div>

    return (
        <EventManageClient
            event={event as Event}
            initialTiers={(tiers as TicketTier[]) || []}
            initialTotalRevenue={totalRevenue}
        />
    )
}
