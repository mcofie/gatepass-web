export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { TicketPdf } from '@/components/pdf/TicketPdf'

export async function GET() {
    try {
        const mockEvent = {
            title: "GATEPASS REVEAL PARTY 2024",
            starts_at: new Date().toISOString(),
            venue_name: "The Sandbox Beach Club",
            venue_address: "South Labadi Estate, Accra, Ghana",
            poster_url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1000"
        }

        const mockTickets = [
            {
                id: "debug-ticket-12345",
                qr_code_hash: "GP-X7Y2-MOCK-HASH",
                guest_name: "Maxwell Cofie",
                ticket_tiers: {
                    name: "VIP ACCESS"
                }
            }
        ]

        const stream = await renderToStream(<TicketPdf event={mockEvent} tickets={mockTickets} />)

        return new NextResponse(stream as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline; filename="debug-ticket.pdf"'
            }
        })
    } catch (error: any) {
        console.error('Debug PDF Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
