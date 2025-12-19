import { createClient } from '@/utils/supabase/server'
import { EventFeed } from '@/components/EventFeed'
import { LandingHeader } from '@/components/LandingHeader'
import React from 'react'

import { Metadata } from 'next'

export const revalidate = 0

export const metadata: Metadata = {
  title: 'GatePass | The Operating System for Modern Events',
  description: 'Discover and book exclusive events, parties, and experiences. GatePass is the premium platform for modern creators and discerning attendees.',
  keywords: ['events', 'tickets', 'nightlife', 'parties', 'gatepass', 'accra', 'ghana', 'experiences'],
  openGraph: {
    title: 'GatePass | The Operating System for Modern Events',
    description: 'Discover and book exclusive events, parties, and experiences.',
    type: 'website',
    locale: 'en_US',
    siteName: 'GatePass',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GatePass | The Operating System for Modern Events',
    description: 'Discover and book exclusive events, parties, and experiences.',
    creator: '@gatepass_io',
  }
}

export default async function Home() {
  const supabase = await createClient()

  // Fetch all active events with their necessary relations
  // Ordered by start date (soonest first)
  const { data: events } = await supabase
    .schema('gatepass')
    .from('events')
    .select(`
      *,
      organizers(*),
      ticket_tiers(*)
    `)
    // .eq('status', 'published') // Temporarily removed for debugging
    .eq('is_featured', true)
    .order('starts_at', { ascending: true })

  // Transform/sort tiers if necessary locally if not working in query
  const eventsWithSortedTiers = (events || []).map(event => ({
    ...event,
    ticket_tiers: (event.ticket_tiers || []).sort((a: any, b: any) => a.price - b.price)
  }))

  return (
    <main className="h-[100dvh] w-full bg-black overflow-hidden relative">
      {/* Global Header/Nav Overlay if needed? 
              EventFeed items have their own header/branding feeling if consistent with Detail page.
              But maybe we want a global "GatePass" overlay that stays putt?
              Let's emulate the detail page where each page handles its own nav/brand for now, 
              or adds it inside EventFeed. 
              
              Actually, let's add a fixed global nav overlay here for consistency across the feed.
          */}
      <EventFeed events={eventsWithSortedTiers} />

      <LandingHeader />
    </main>
  )
}
