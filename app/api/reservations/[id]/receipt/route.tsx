export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { ReceiptPdf, type ReceiptData, type ReceiptLine } from '@/components/pdf/ReceiptPdf'
import { getProvider } from '@/lib/integrations/providers'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: reservationId } = await params

        const supabase = await createClient()
        const adminSupabase = createAdminClient()

        // Get current user for ownership check
        const { data: { user } } = await supabase.auth.getUser()

        // 1. Fetch Reservation (use admin to bypass RLS)
        const { data: reservation, error: resError } = await adminSupabase
            .schema('gatepass')
            .from('reservations')
            .select(`
                *,
                ticket_tiers ( name, price, currency ),
                events (
                    title,
                    starts_at,
                    venue_name,
                    organizers ( name )
                ),
                profiles ( full_name, email )
            `)
            .eq('id', reservationId)
            .single()

        if (resError || !reservation) {
            return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
        }

        // Ownership check: user must own reservation OR be admin OR be a guest (no user)
        if (user && reservation.user_id && reservation.user_id !== user.id) {
            // Check if user is admin (bypass)
            const { data: profile } = await supabase
                .schema('gatepass')
                .from('profiles')
                .select('is_super_admin')
                .eq('id', user.id)
                .single()

            if (!profile?.is_super_admin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        // 2. The payment for this order. Multi-ticket orders log one transaction against several reservations.
        const { data: transactions } = await adminSupabase
            .schema('gatepass')
            .from('transactions')
            .select('*')
            .or(`reservation_id.eq.${reservationId},metadata->reservation_ids.cs.["${reservationId}"]`)
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(1)
        const transaction = transactions?.[0] ?? null

        const reservationIds: string[] = Array.isArray(transaction?.metadata?.reservation_ids) && transaction.metadata.reservation_ids.length
            ? transaction.metadata.reservation_ids
            : [reservationId]
        const { data: orderRows } = await adminSupabase
            .schema('gatepass')
            .from('reservations')
            .select('id, quantity, addons, ticket_tiers ( name, price, currency, min_quantity, discount_type, discount_value ), discounts ( code, type, value )')
            .in('id', reservationIds)

        const event = Array.isArray(reservation.events) ? reservation.events[0] : reservation.events
        const currency = (transaction?.currency || reservation.ticket_tiers?.currency || 'GHS').toUpperCase()

        // 3. Line items from the order itself
        const lines: ReceiptLine[] = []
        const addonQuantities: Record<string, number> = {}
        for (const row of (orderRows ?? []) as any[]) {
            const tier = Array.isArray(row.ticket_tiers) ? row.ticket_tiers[0] : row.ticket_tiers
            const qty = row.quantity || 1
            let subtotal = (tier?.price || 0) * qty
            if (tier?.min_quantity && qty >= tier.min_quantity && tier.discount_value) {
                subtotal = tier.discount_type === 'percentage' ? subtotal * (1 - tier.discount_value / 100) : Math.max(0, subtotal - tier.discount_value)
            }
            lines.push({ label: tier?.name || 'Ticket', detail: `× ${qty}`, amount: subtotal })
            const discount = Array.isArray(row.discounts) ? row.discounts[0] : row.discounts
            if (discount?.value) {
                lines.push({ label: `Promo ${discount.code ?? ''}`.trim(), detail: discount.type === 'percentage' ? `${discount.value}% off` : undefined, amount: -(discount.type === 'percentage' ? subtotal * discount.value / 100 : discount.value), tone: 'muted' })
            }
            for (const [id, q] of Object.entries((row.addons ?? {}) as Record<string, number>)) addonQuantities[id] = (addonQuantities[id] ?? 0) + Number(q)
        }
        const addonIds = Object.keys(addonQuantities).filter(id => addonQuantities[id] > 0)
        if (addonIds.length) {
            const { data: addons } = await adminSupabase.schema('gatepass').from('event_addons').select('id, name, price').in('id', addonIds)
            for (const addon of addons ?? []) lines.push({ label: addon.name, detail: `× ${addonQuantities[addon.id]}`, amount: addon.price * addonQuantities[addon.id] })
        }

        const itemsTotal = lines.reduce((sum, line) => sum + line.amount, 0)
        const total = transaction ? Number(transaction.amount) : Math.max(0, itemsTotal)
        if (transaction && total - itemsTotal > 0.009) lines.push({ label: 'Fees paid by buyer', amount: total - itemsTotal, tone: 'muted' })

        const providerId: string | undefined = transaction?.metadata?.provider
        const provider = providerId && providerId !== 'free' ? getProvider('payments', providerId) : undefined
        const method = transaction?.channel && transaction.channel !== 'free' ? String(transaction.channel).replace(/_/g, ' ') : null
        const organizerRel = Array.isArray(event?.organizers) ? event.organizers[0] : event?.organizers

        const data: ReceiptData = {
            reference: transaction?.reference || reservation.reference || reservationId.slice(0, 8).toUpperCase(),
            paidAt: transaction?.paid_at || transaction?.created_at || reservation.created_at,
            status: total === 0 ? 'free' : transaction ? 'paid' : 'pending',
            currency,
            total,
            lines,
            buyer: { name: reservation.profiles?.full_name || reservation.guest_name || 'Guest', email: reservation.profiles?.email || reservation.guest_email },
            event: { title: event?.title || 'Event', startsAt: event?.starts_at, venue: event?.venue_name },
            organizer: organizerRel?.name ?? null,
            provider: provider ? { name: provider.name, method: method ? method.charAt(0).toUpperCase() + method.slice(1) : null } : null,
        }

        const stream = await renderToStream(<ReceiptPdf data={data} />)

        return new NextResponse(stream as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="gatepass-receipt-${data.reference}.pdf"`
            }
        })

    } catch (error: any) {
        console.error('Receipt PDF Error:', error)
        return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 })
    }
}
