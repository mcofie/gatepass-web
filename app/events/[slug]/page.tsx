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
        <div className="min-h-screen bg-white dark:bg-black font-sans selection:bg-orange-100 selection:text-orange-900 pb-20 transition-colors duration-300">
            <div className="container mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-8 max-w-7xl">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-8 md:mb-12 font-medium tracking-wide">
                    <span className="hover:text-black dark:hover:text-white cursor-pointer transition-colors">Discover</span>
                    <span>/</span>
                    <span className="text-gray-900 dark:text-white">{event.title}</span>
                </div>

                <div className="grid lg:grid-cols-12 gap-10 md:gap-16 items-start">
                    {/* Left Column: Poster */}
                    <div className="lg:col-span-5 relative">
                        <div className="aspect-[4/5] w-full relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-transparent dark:border-gray-800">
                            <img
                                src={event.poster_url || 'https://placehold.co/1200x400'}
                                className="w-full h-full object-cover"
                                alt={event.title}
                            />
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="lg:col-span-7 space-y-10 md:space-y-12">
                        <div className="space-y-6 md:space-y-8">
                            <h1 className="text-3xl md:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-[1.1]">{event.title}</h1>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4 group">
                                    <div className="mt-1 text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white text-lg">Sunday, December 28th 2025</p>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium">12:00 PM - 8:00 PM UTC</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 group">
                                    <div className="mt-1 text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white text-lg">{event.venue_name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{event.venue_address}</p>
                                        <a
                                            href={`https://maps.google.com/?q=${encodeURIComponent(event.venue_address || '')}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-0.5 hover:border-black dark:hover:border-white transition-all"
                                        >
                                            View on Map
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 md:pt-10 border-t border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">About</h3>
                            <div className="prose prose-gray dark:prose-invert max-w-none">
                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-lg font-light">{event.description}</p>
                            </div>
                        </div>

                        {/* Ticket Selection Area (Client Component) */}
                        <div id="tickets" className="pt-4">
                            <EventDetailClient event={event as Event} tiers={(tiers as TicketTier[]) || []} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
