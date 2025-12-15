import { createClient } from '@/utils/supabase/server'
import { EventDetailClient } from '@/components/EventDetailClient'
import { Event, TicketTier } from '@/types/gatepass'
import { Metadata } from 'next'

interface PageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const supabase = await createClient()
    const { slug } = await params

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

    let query = supabase
        .schema('gatepass')
        .from('events')
        .select('title, description, poster_url')

    if (isUuid) {
        query = query.eq('id', slug)
    } else {
        query = query.eq('slug', slug)
    }

    const { data: event } = await query.single()

    if (!event) {
        return {
            title: 'Event Not Found | GatePass',
        }
    }

    return {
        title: `${event.title} | GatePass`,
        description: event.description,
        openGraph: {
            title: event.title,
            description: event.description,
            images: event.poster_url ? [event.poster_url] : [],
        },
    }
}

export default async function EventPage({ params }: PageProps) {
    const supabase = await createClient()
    const { slug } = await params

    // Check if slug is UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

    let query = supabase
        .schema('gatepass')
        .from('events')
        .select('*, organizers(*)')

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
        <div className="h-screen w-full bg-black relative overflow-hidden">
            {/* Full Screen Background */}
            <div className="absolute inset-0 z-0">
                {event.video_url ? (
                    <video
                        src={event.video_url}
                        className="w-full h-full object-cover opacity-90 transition-opacity duration-1000"
                        autoPlay
                        loop
                        muted
                        playsInline
                        poster={event.poster_url}
                    />
                ) : (
                    <img
                        src={event.poster_url}
                        alt="Event Background"
                        className="w-full h-full object-cover opacity-90"
                    />
                )}
                {/* Subtle Cinematic Vignette - Darker at bottom for card visibility if on mobile */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            </div>

            {/* Navigation & Brand */}
            <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-10 pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    {/* Platform Name */}
                    <a href="/" className="text-white font-bold text-lg hover:opacity-80 transition-opacity">
                        GatePass
                    </a>
                </div>
            </div>

            {/* Floating Details Card */}
            <EventDetailClient event={event as Event} tiers={(tiers as TicketTier[]) || []} />
        </div>
    )
}
