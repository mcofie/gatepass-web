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
        .select('title, description, poster_url, is_published')

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

    // SEO Protection for Unpublished
    if (!event.is_published) {
        return {
            title: `Preview: ${event.title} | GatePass`,
            robots: {
                index: false,
                follow: false,
            }
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

    // ----------------------------------------------------------------
    // Authorization Check for Private Events
    // ----------------------------------------------------------------
    const { data: { user } } = await supabase.auth.getUser()
    let canView = event.is_published

    if (!canView && user) {
        // 1. Owner Check
        if (event.organizers?.user_id === user.id) {
            canView = true
        } else {
            // 2. Team Check
            const { data: teamMember } = await supabase.schema('gatepass').from('organization_team')
                .select('role')
                .eq('organization_id', event.organization_id)
                .eq('user_id', user.id)
                .single()

            if (teamMember && (teamMember.role === 'admin' || teamMember.role === 'owner')) {
                canView = true
            }
        }
    }

    if (!canView) {
        return (
            <div className="h-[100dvh] w-full bg-black flex flex-col items-center justify-center relative overflow-hidden">
                <LandingHeader />
                <div className="text-center space-y-6 z-10 px-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto border border-zinc-800 shadow-2xl">
                        <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Event Unavailable</h1>
                        <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
                            This event is currently private or has not been published yet. <br />
                            Please check back later or contact the organizer.
                        </p>
                    </div>
                </div>
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
        <div className="h-[100dvh] w-full bg-black relative overflow-hidden">
            {/* Full Screen Background */}
            <EventBackground
                videoUrl={event.video_url}
                posterUrl={event.poster_url}
                layoutId={`event-bg-${event.id}`}
            />
            {/* Subtle Cinematic Vignette - Darker at bottom for card visibility if on mobile */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* DRAFT MODE BANNER */}
            {!event.is_published && (
                <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-black text-[11px] font-bold uppercase tracking-widest text-center py-2 z-50 pointer-events-auto">
                    Draft Preview — Only visible to you
                </div>
            )}

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
            <EventDetailClient
                event={event as Event}
                tiers={(tiers as TicketTier[]) || []}
                layoutId={`event-card-${event.id}`}
            />
        </div >
    )
}
