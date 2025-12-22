export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { ReceiptPdf } from '@/components/pdf/ReceiptPdf'
import { format } from 'date-fns'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: reservationId } = await params

        const supabase = await createClient()

        // Get current user for ownership check
        const { data: { user } } = await supabase.auth.getUser()

        // 1. Fetch Reservation
        const { data: reservation, error: resError } = await supabase
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

        // Ownership check: user must own reservation OR be admin
        // For guest purchases, we allow access if they have the link (UUID is unguessable)
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

        // 2. Fetch Transaction
        // We need the successful payment transaction to show actual amount paid
        const { data: transactions } = await supabase
            .schema('gatepass')
            .from('transactions')
            .select('*')
            .eq('reservation_id', reservationId)
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(1)

        const transaction = transactions?.[0]

        if (!transaction) {
            // Fallback? If reservation is confirmed but no log (weird, but possible in legacy data), use tier price
            console.warn('Receipt Generation: No transaction log found for confirmed reservation', reservationId)
        }

        // 3. Render
        const formattedDate = format(new Date(reservation.created_at), 'PPP')

        // Normalize nested arrays if Supabase returns them (unlikely with .single() on lookup but possible on relations)
        const event = Array.isArray(reservation.events) ? reservation.events[0] : reservation.events

        const stream = await renderToStream(
            <ReceiptPdf
                reservation={reservation}
                transaction={transaction || { amount: (reservation.ticket_tiers?.price || 0) * (reservation.quantity || 1), currency: reservation.ticket_tiers?.currency }}
                event={event}
                formattedDate={formattedDate}
            />
        )

        return new NextResponse(stream as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="gatepass-receipt-${reservation.reference}.pdf"`
            }
        })

    } catch (error: any) {
        console.error('Receipt PDF Error:', error)
        return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 })
    }
}
