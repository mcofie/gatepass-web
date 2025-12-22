export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { TicketPdf } from '@/components/pdf/TicketPdf'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next.js 15+ (and likely 16)
) {
    try {
        const { id: ticketId } = await params

        const supabase = await createClient()

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
                    address,
                    poster_url
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

        const processedTicket = {
            ...ticket,
            ticket_tiers: tier,
            profiles: profile
        }

        // 3. Render Stream
        const stream = await renderToStream(<TicketPdf event={event} tickets={[processedTicket]} />)

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
