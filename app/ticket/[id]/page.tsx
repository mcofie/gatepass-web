
import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Calendar, Ticket, ArrowLeft } from 'lucide-react'
import { PublicTicketActions } from '@/components/ticket/PublicTicketActions'
import { ReceiptTicket } from '@/components/ticket/ReceiptTicket'
// Actually, for a public page, a react component is better/cleaner if installed.
// The email used: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...
// I'll stick to the API for consistency and zero-dep for now, or just use an img tag.

// Force dynamic to ensure we always fetch fresh data
export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    return {
        title: `Ticket - ${id.substring(0, 8).toUpperCase()}`,
        description: 'View your event ticket'
    }
}

export default async function PublicTicketPage({ params }: Props) {
    const { id } = await params

    // 1. Init Supabase with Service Role to bypass RLS
    // We only have read access to one specific ID, so this is safe pattern for "magic link" style access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
        return <div className="p-10 text-center">System Configuration Error</div>
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 2. Fetch Ticket
    const { data: ticket, error } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select(`
            *,
            events (
                *,
                organizers (name, logo_url)
            ),
            ticket_tiers (*),
            profiles:user_id (*)
        `)
        .eq('id', id)
        .single()

    if (error || !ticket) {
        console.error('Ticket Fetch Error:', error)
        return notFound()
    }

    // 3. Format Data
    const event = ticket.events
    const tier = ticket.ticket_tiers
    const profile = ticket.profiles // might be null if guest checkout? 
    // Wait, ticket table usually has user_id. Guest checkout logic might put a profile or not?
    // In `payment.ts`, we saw `reservation.guest_name`. Ticket table might not capture guest name if it just links to user_id.
    // Let's check if there's a reservation link?
    // `tickets` has `reservation_id`. We might need to fetch reservation to get guest name if user_id is null/anon.
    // For now, let's try to get what we can.

    // Fetch Reservation if needed for guest name
    let guestName = profile?.full_name || 'Guest'
    if (!profile) {
        const { data: res } = await supabase.schema('gatepass').from('reservations').select('guest_name').eq('id', ticket.reservation_id).single()
        if (res?.guest_name) guestName = res.guest_name
    }

    const qrData = ticket.qr_code_hash || ticket.id
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`

    const eventDate = new Date(event.starts_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })
    const eventTime = new Date(event.starts_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric'
    })

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden" style={{ backgroundColor: '#171717' }}>

            {/* Immersive Background */}
            <div className="absolute inset-0 z-0">
                {event.poster_url && (
                    <Image
                        src={event.poster_url}
                        alt=""
                        fill
                        className="object-cover opacity-30 blur-3xl scale-110"
                        priority
                    />
                )}
                <div className="absolute inset-0" style={{ backgroundColor: 'rgba(23, 23, 23, 0.6)' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #171717, transparent, #171717)' }} />
            </div>

            {/* Brand Header */}
            <div className="absolute top-0 w-full p-8 flex justify-center z-10">
                <div className="flex items-center gap-2 opacity-50">
                    <div className="w-2 h-2 rounded-full animate-pulse z-20" style={{ backgroundColor: '#ffffff' }} />
                    <span className="text-xs font-bold tracking-[0.2em] uppercase z-20" style={{ color: '#ffffff' }}>GatePass Verified</span>
                </div>
            </div>

            {/* Ticket Container */}
            <div className="w-full max-w-sm relative z-10 animate-fade-in-up flex flex-col items-center">

                {/* 1. Visible Ticket (Interactive) */}
                <ReceiptTicket
                    id="ticket-card"
                    event={{
                        ...event,
                        venue_address: event.venue_address || '' // Ensure string
                    }}
                    ticket={{
                        ...ticket,
                        reservations: {
                            guest_name: guestName
                        }
                    }}
                    tierName={tier.name}
                    logoUrl={event.organizers?.logo_url}
                    forceExpanded={true} // Always expanded for public view
                    isPrint={false}
                />

                {/* 2. Hidden Ticket for Print (Exact Receipt Style) */}
                <div className="absolute top-0 left-[-9999px]">
                    <div id="ticket-print-target">
                        <ReceiptTicket
                            event={{
                                ...event,
                                venue_address: event.venue_address || ''
                            }}
                            ticket={{
                                ...ticket,
                                reservations: {
                                    guest_name: guestName
                                }
                            }}
                            tierName={tier.name}
                            logoUrl={event.organizers?.logo_url}
                            forceExpanded={true}
                            isPrint={true}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="w-full max-w-[300px] mt-6">
                    <PublicTicketActions ticketId={ticket.id} eventTitle={event.title} />
                </div>

                <div className="mt-8 flex justify-center opacity-30">
                    <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#ffffff' }}>Verified Ticket</p>
                </div>

            </div>

            <p className="mt-8 text-xs font-medium opacity-50" style={{ color: '#71717a' }}>GatePass Inc.</p>
        </div>
    )
}
