import { createClient } from '@/utils/supabase/server'
import { EventDetailClient } from '@/components/EventDetailClient'
import { Event, TicketTier } from '@/types/gatepass'

interface PageProps {
    params: Promise<{ slug: string }>
}

export default async function EventPage({ params }: PageProps) {
    const supabase = await createClient()
    const { slug } = await params

    // Check if slug is UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

    let query = supabase
        .schema('gatepass')
        .from('events')
        .select('*')

    if (isUuid) {
        query = query.eq('id', slug)
    } else {
        query = query.eq('slug', slug)
    }

    const { data: event } = await query.single()

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Event not found.</p>
            </div>
        )
    }

    // Fetch tiers
    const { data: tiers } = await supabase
        .schema('gatepass')
        .from('ticket_tiers')
        .select('*')
        .eq('event_id', event.id)
        .order('price', { ascending: true })

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-amber-500/30 selection:text-amber-200 pb-20">
            {/* Immersive Hero Section */}
            <div className="relative w-full h-[85vh] overflow-hidden">
                {/* Background Image with Blur */}
                <div className="absolute inset-0">
                    <img
                        src={event.poster_url || 'https://placehold.co/1200x800'}
                        className="w-full h-full object-cover opacity-60 scale-105 blur-sm"
                        alt={event.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
                </div>

                {/* Hero Content */}
                <div className="relative h-full container mx-auto px-4 md:px-6 flex flex-col justify-end pb-20">
                    <div className="max-w-4xl space-y-6 animate-slide-up">
                        {/* Date Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-sm font-medium text-amber-400">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Upcoming Event</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white leading-[0.9]">
                            {event.title}
                        </h1>

                        <div className="flex flex-col md:flex-row gap-6 md:items-center text-lg text-gray-300">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span>Sunday, December 28th 2025</span>
                            </div>
                            <div className="hidden md:block w-px h-4 bg-white/20"></div>
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                <span>{event.venue_name}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="container mx-auto px-4 md:px-6 py-12 -mt-10 relative z-10">
                <div className="grid lg:grid-cols-12 gap-12">
                    {/* Left Column: Description & Media */}
                    <div className="lg:col-span-7 space-y-12">
                        {/* Description Card */}
                        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl space-y-6">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="p-2 rounded-lg bg-white/5 border border-white/10">
                                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                                </span>
                                About Event
                            </h3>
                            <div className="prose prose-invert prose-lg max-w-none text-gray-400 leading-relaxed font-light">
                                <p>{event.description}</p>
                            </div>
                        </div>

                        {/* Location Card */}
                        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl space-y-6">
                            <div className="flex justify-between items-start">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <span className="p-2 rounded-lg bg-white/5 border border-white/10">
                                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    </span>
                                    Venue Info
                                </h3>
                                <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(event.venue_address || '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-colors"
                                >
                                    Open Maps ↗
                                </a>
                            </div>
                            <div>
                                <h4 className="text-xl font-semibold text-white">{event.venue_name}</h4>
                                <p className="text-gray-400 mt-1">{event.venue_address}</p>
                            </div>
                            {/* Placeholder Map */}
                            <div className="w-full h-48 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
                                <span className="text-gray-600 text-sm tracking-widest uppercase">Map View</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Ticket Selection (Sticky) */}
                    <div className="lg:col-span-5 relative">
                        <div className="sticky top-24">
                            <EventDetailClient event={event as Event} tiers={(tiers as TicketTier[]) || []} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
