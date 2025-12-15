import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { TicketTier, Event } from '@/types/gatepass'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'My Tickets',
}

interface TicketWithRelations {
    id: string
    qr_code_hash: string
    events: Event
    ticket_tiers: TicketTier
}

export const revalidate = 0

export default async function MyTicketsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null // Handled by middleware

    const { data: tickets, error } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('*, events(*), ticket_tiers(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Fetch error:', error)
    }

    return (
        <div className="container mx-auto p-4 md:p-8 min-h-screen">
            <h1 className="text-3xl font-bold mb-8">My Tickets</h1>

            {tickets && tickets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tickets.map((ticket: any) => (
                        <div key={ticket.id} className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
                            {/* Event Header */}
                            <div className="bg-gray-900 text-white p-4">
                                <h3 className="font-bold text-lg">{ticket.events?.title}</h3>
                                <p className="text-gray-400 text-sm">{ticket.events?.venue_name}</p>
                            </div>

                            {/* Ticket Body */}
                            <div className="p-6 flex-grow flex flex-col items-center justify-center space-y-4">
                                <div className="text-center">
                                    <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-xs font-bold uppercase tracking-wide text-gray-600">
                                        {ticket.ticket_tiers?.name}
                                    </span>
                                </div>

                                {/* QR Placeholder */}
                                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                                    <code className="text-xs text-center text-gray-500 break-all p-2">{ticket.qr_code_hash}</code>
                                </div>

                                <p className="text-xs text-gray-400">Scan at entrance</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 mb-4">You haven't purchased any tickets yet.</p>
                    <Link href="/" className="text-black underline font-medium">Browse Events</Link>
                </div>
            )}
        </div>
    )
}
