
import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Calendar, Ticket, ArrowLeft } from 'lucide-react'
import { PublicTicketActions } from '@/components/ticket/PublicTicketActions'
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
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ffffff' }} />
                    <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#ffffff' }}>GatePass Verified</span>
                </div>
            </div>

            {/* Ticket Container */}
            <div id="ticket-card" className="w-full max-w-sm relative drop-shadow-2xl z-10 animate-fade-in-up" style={{ backgroundColor: 'transparent' }}>

                {/* --- MAIN TICKET BODY --- */}
                <div className="rounded-t-3xl overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
                    {/* Event Image */}
                    <div className="h-64 relative" style={{ backgroundColor: '#111827' }}>
                        {event.poster_url ? (
                            <Image
                                src={event.poster_url}
                                alt={event.title}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="font-bold tracking-widest uppercase" style={{ color: '#6b7280' }}>Event</span>
                            </div>
                        )}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4), transparent)' }} />

                        <div className="absolute bottom-6 left-6 right-6">
                            <h1 className="text-2xl font-black leading-tight mb-2 drop-shadow-md" style={{ color: '#ffffff' }}>{event.title}</h1>
                            <p className="font-medium text-sm flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                <MapPin className="w-4 h-4" style={{ color: '#ffffff' }} />
                                {event.venue_name}
                            </p>
                        </div>
                    </div>

                    {/* Main Details */}
                    <div className="p-6 pb-8">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Date</p>
                                <p className="font-bold text-lg leading-tight" style={{ color: '#111827' }}>{eventDate}</p>
                                <p className="text-sm font-medium" style={{ color: '#6b7280' }}>{eventTime}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Admit One</p>
                                <p className="font-bold text-lg leading-tight" style={{ color: '#111827' }}>{tier.name}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl p-4 flex items-center gap-4 border border-dashed" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                            <div className="p-1.5 rounded-lg shadow-sm border flex-shrink-0" style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }}>
                                <Image
                                    src={qrUrl}
                                    alt="Ticket QR"
                                    width={64}
                                    height={64}
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-mono mb-1 truncate" style={{ color: '#9ca3af' }}>ID: {ticket.id.toUpperCase()}</p>
                                <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
                                    <div className="h-full w-2/3" style={{ backgroundColor: '#000000' }} />
                                </div>
                                <p className="text-[10px] mt-1.5 uppercase tracking-wide" style={{ color: '#9ca3af' }}>Scan at entry</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- PERFORATION --- */}
                <div className="relative h-8 w-full overflow-hidden flex items-center" style={{ backgroundColor: '#ffffff' }}>
                    <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: '#171717' }} />
                    <div className="w-full border-b-2 border-dashed h-[1px] mx-4" style={{ borderColor: '#d1d5db' }} />
                    <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: '#171717' }} />
                </div>

                {/* --- TICKET STUB (Details & Actions) --- */}
                <div className="rounded-b-3xl p-6 border-t-0 relative" style={{ backgroundColor: '#fafafa' }}>
                    <div className="mb-6 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Ticket Holder</p>
                        <p className="text-xl font-black tracking-tight" style={{ color: '#111827' }}>{guestName}</p>
                    </div>

                    <PublicTicketActions ticketId={ticket.id} eventTitle={event.title} />

                    <div className="mt-6 flex justify-center opacity-30">
                        <div className="h-4" /> {/* Spacer */}
                        <Image src="/logo-black.png" alt="GatePass" width={60} height={20} className="hidden" /> {/* Placeholder checks */}
                        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#000000' }}>Verified Ticket</p>
                    </div>
                </div>

            </div>

            <p className="mt-8 text-xs font-medium opacity-50" style={{ color: '#71717a' }}>GatePass Inc.</p>
        </div>
    )
}
