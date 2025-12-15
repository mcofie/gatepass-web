
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Share2 } from 'lucide-react'

// Force dynamic to ensure fresh data
export const dynamic = 'force-dynamic'

export default async function PublicTicketPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch listing
    const { data: ticket } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('*, events(*), ticket_tiers(*), reservations(*)')
        .eq('id', id)
        .single()

    if (!ticket) {
        notFound()
    }

    const event = ticket.events
    const tier = ticket.ticket_tiers
    const guestName = ticket.reservations?.guest_name || ticket.reservations?.profiles?.full_name || 'Guest'

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden relative">

                {/* Event Image Banner */}
                <div className="h-48 bg-black relative">
                    {event.image_url ? (
                        <Image
                            src={event.image_url}
                            alt={event.title}
                            fill
                            className="object-cover opacity-80"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20 font-bold text-4xl">
                            {event.title.charAt(0)}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                    <div className="absolute bottom-4 left-6 right-6 text-white">
                        <h1 className="text-2xl font-bold leading-tight mb-1">{event.title}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                            <MapPin className="w-4 h-4" />
                            {event.venue_name}
                        </div>
                    </div>
                </div>

                {/* Ticket Details */}
                <div className="p-6 relative">
                    {/* Punch Hole */}
                    <div className="absolute -top-3 left-1/2 -ml-3 w-6 h-6 bg-gray-50 rounded-full" />

                    <div className="text-center mb-6">
                        <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Admit One</p>
                        <h2 className="text-xl font-bold text-gray-900">{guestName}</h2>
                        <span className="inline-block mt-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                            {tier.name}
                        </span>
                    </div>

                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qr_code_hash}&color=000000`}
                                alt="QR Code"
                                className="w-48 h-48 object-contain mix-blend-multiply"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-gray-100 pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 font-medium uppercase">Date</p>
                                    <p className="text-sm font-bold text-gray-900">
                                        {new Date(event.starts_at).toLocaleDateString('en-US', {
                                            weekday: 'short', month: 'short', day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 font-medium uppercase">Time</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {new Date(event.starts_at).toLocaleTimeString('en-US', {
                                        hour: 'numeric', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <Link
                            href={`/events/${event.slug || event.id}`}
                            className="block w-full text-center py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-colors"
                        >
                            View Event Details
                        </Link>
                    </div>

                </div>
            </div>

            <p className="mt-6 text-xs text-gray-400 font-medium">
                Powered by GatePass
            </p>
        </div>
    )
}
