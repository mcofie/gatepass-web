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
    const { data: tiers } = await supabase.schema('gatepass').from('ticket_tiers').select('*, payment_plans(*)').eq('event_id', id).order('sort_order', { ascending: true })

    // Calculate Total Realized Revenue (Server Side) with Strict Net Logic
    const { data: transactions } = await supabase
        .schema('gatepass')
        .from('transactions')
        .select(`
            amount,
            platform_fee,
            applied_processor_fee,
            applied_fee_rate,
            applied_processor_rate,
            metadata,
            reservations!inner(
                quantity,
                ticket_tiers(price),
                discounts(type, value),
                events!inner(fee_bearer),
                addons
            )
        `)
        .eq('status', 'success')
        .eq('reservations.event_id', id)

    // Determine User Role
    const { data: { user } } = await supabase.auth.getUser()
    let role = 'Member'

    if (user && event) {
        // 1. Check if Owner
        const { data: org } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('user_id', user.id)
            .eq('id', event.organization_id)
            .single()

        if (org) {
            role = 'Owner'
        } else {
            // 2. Check if Team member
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('role')
                .eq('user_id', user.id)
                .eq('organization_id', event.organization_id)
                .single()

            if (teamMember) {
                role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
            }
        }
    }

    let totalRevenue = 0
    let totalDiscountValue = 0

    if (transactions) {
        totalRevenue = transactions.reduce((acc, tx) => {
            const r = tx.reservations as any
            const price = r.ticket_tiers?.price || 0
            const quantity = r.quantity || 1
            const feeBearer = r.events?.fee_bearer || 'customer'
            const isInstalment = tx.metadata?.payment_type === 'instalment' || tx.metadata?.metadata?.payment_type === 'instalment'

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

            // Recalculate Logic to Normalize Display
            const platformRate = tx.applied_fee_rate ?? 0.04
            // Normalize old 2% rate to current 1.95%
            const storedProcessorRate = tx.applied_processor_rate
            const processorRate = (storedProcessorRate === 0.02 || !storedProcessorRate)
                ? 0.0195
                : storedProcessorRate

            let finalPlatformFee = tx.platform_fee
            if (finalPlatformFee == null || finalPlatformFee === 0) {
                finalPlatformFee = isInstalment
                    ? tx.amount * platformRate
                    : subtotal * platformRate
            }

            const finalProcessorFee = (tx.applied_processor_fee != null)
                ? tx.applied_processor_fee
                : tx.amount * processorRate

            // Payout: When customer bears fees, processor fee is NOT deducted from organizer
            const organizerPayout = feeBearer === 'customer'
                ? tx.amount - finalPlatformFee
                : tx.amount - finalPlatformFee - finalProcessorFee

            return acc + organizerPayout
        }, 0)

        totalDiscountValue = transactions.reduce((acc, tx) => {
            const r = tx.reservations as any
            const price = r.ticket_tiers?.price || 0
            const quantity = r.quantity || 1

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
            return acc + discountAmount
        }, 0)
    }

    if (!event) return <div>Event not found</div>

    return (
        <EventManageClient
            event={event as Event}
            initialTiers={(tiers as TicketTier[]) || []}
            initialTotalRevenue={totalRevenue}
            initialTotalDiscountValue={totalDiscountValue}
            userRole={role}
        />
    )
}
