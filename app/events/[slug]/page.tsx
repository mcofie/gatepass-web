import { createClient } from '@/utils/supabase/server'
import { EventDetailClient } from '@/components/EventDetailClient'
import { EventBackground } from '@/components/EventBackground'
import { LandingHeader } from '@/components/LandingHeader'
import React from 'react'
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
            <EventBackground
                videoUrl={event.video_url}
                posterUrl={event.poster_url}
            />
            {/* Subtle Cinematic Vignette - Darker at bottom for card visibility if on mobile */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Navigation & Brand */}
            <LandingHeader />


            {/* Social Links (Bottom Left) */}
            <div className="absolute bottom-6 left-8 z-10 flex items-center gap-4 pointer-events-auto">
                {(event.social_website || event.organizers?.website) && (
                    <a href={event.social_website || event.organizers?.website} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    </a>
                )}
                {(event.social_instagram || event.organizers?.instagram) && (
                    <a href={event.social_instagram || event.organizers?.instagram} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" display="none" /><rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2" /></svg>
                    </a>
                )}
                {(event.social_twitter || event.organizers?.twitter) && (
                    <a href={event.social_twitter || event.organizers?.twitter} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    </a>
                )}
                {(event.social_facebook || event.organizers?.facebook) && (
                    <a href={event.social_facebook || event.organizers?.facebook} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>
                    </a>
                )}
            </div>

            {/* Floating Details Card */}
            <EventDetailClient event={event as Event} tiers={(tiers as TicketTier[]) || []} />
        </div >
    )
}
