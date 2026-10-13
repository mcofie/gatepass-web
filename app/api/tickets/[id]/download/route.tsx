export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { TicketPdf, withQrCodes } from '@/components/pdf/TicketPdf'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next.js 15+ (and likely 16)
) {
    try {
        const { id: ticketId } = await params

        // Same access as the public pass page (/ticket/[id]): the unguessable ticket id is the key
        const supabase = createAdminClient()

        // 1. Fetch Ticket with Event and Profile
        const { data: ticket, error } = await supabase
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
                    poster_url,
                    currency,
                    organizers ( name )
                ),
                profiles ( full_name )
            `)
            .eq('id', ticketId)
            .single()

        if (error || !ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
        }

        // 2. Prepare Data
        const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
        const tier = Array.isArray(ticket.ticket_tiers) ? ticket.ticket_tiers[0] : ticket.ticket_tiers
        const profile = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles

        // Guest checkouts have no profile: use the name given at checkout
        let guestName: string | null = null
        if (!profile?.full_name && ticket.reservation_id) {
            const { data: reservation } = await supabase.schema('gatepass').from('reservations').select('guest_name').eq('id', ticket.reservation_id).maybeSingle()
            guestName = reservation?.guest_name ?? null
        }
        const processedTicket = {
            ...ticket,
            guest_name: guestName,
            ticket_tiers: tier,
            profiles: profile
        }

        // 3. Render Stream
        const stream = await renderToStream(<TicketPdf event={event} tickets={await withQrCodes([processedTicket])} />)

        // 4. Return Response
        // Convert Node stream to Web ReadableStream
        // @react-pdf/renderer renderToStream returns a Node.js stream.
        // We need to construct a response.

        return new NextResponse(stream as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="gatepass-ticket-${ticketId.substring(0, 8)}.pdf"`
            }
        })

    } catch (error: any) {
        console.error('PDF Generation Error:', error)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
