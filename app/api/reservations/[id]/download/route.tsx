export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { TicketPdf } from '@/components/pdf/TicketPdf'

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

        // 1. Fetch Reservation to check ownership (use admin to bypass RLS)
        const { data: reservation, error: resError } = await adminSupabase
            .schema('gatepass')
            .from('reservations')
            .select('user_id, guest_email')
            .eq('id', reservationId)
            .single()

        if (resError || !reservation) {
            return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
        }

        // Ownership check: user must own reservation OR be admin OR be a guest (no user)
        // For guest purchases, allow access if they have the link (UUID is unguessable)
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

        // 2. Fetch Tickets (use admin client to bypass RLS)
        const { data: tickets, error: ticketError } = await adminSupabase
            .schema('gatepass')
            .from('tickets')
            .select(`
                *,
                ticket_tiers ( name ),
                events (
                    title,
                    starts_at,
                    venue_name,
                    venue_address,
                    poster_url
                ),
                profiles ( full_name )
            `)
            .eq('reservation_id', reservationId)

        if (ticketError || !tickets || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets found for this reservation' }, { status: 404 })
        }

        // 2. Prepare Data
        // Event data is same for all tickets
        const event = Array.isArray(tickets[0].events) ? tickets[0].events[0] : tickets[0].events

        // Normalize nested data for each ticket
        const processedTickets = tickets.map(t => ({
            ...t,
            ticket_tiers: Array.isArray(t.ticket_tiers) ? t.ticket_tiers[0] : t.ticket_tiers,
            profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
        }))

        // 3. Render Stream
        const stream = await renderToStream(<TicketPdf event={event} tickets={processedTickets} />)

        // 4. Return Response
        return new NextResponse(stream as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="gatepass-tickets-${reservationId.substring(0, 8)}.pdf"`
            }
        })

    } catch (error: any) {
        console.error('PDF Generation Error:', error)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
