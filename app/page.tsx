import { createClient } from '@supabase/supabase-js'
import { EventFeed } from '@/components/EventFeed'
import { LandingHeader } from '@/components/LandingHeader'
import { unstable_cache } from 'next/cache'
import { Suspense } from 'react'

import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const getFeaturedEvents = unstable_cache(async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data, error } = await supabase
    .schema('gatepass')
    .from('events')
    .select(`
      *,
      organizers(id, name, description, website, instagram, twitter),
      ticket_tiers(*, payment_plans(*))
    `)
    .eq('is_featured', true)
    .eq('is_published', true)
    .order('starts_at', { ascending: true })

  if (error) throw error

  return (data || []).map(event => ({
    ...event,
    ticket_tiers: [...(event.ticket_tiers || [])].sort((a: any, b: any) => a.price - b.price),
  }))
}, ['featured-events-v1'], { revalidate: 15 })

export const metadata: Metadata = {
  title: 'GatePass | The Operating System for Modern Events',
  description: 'Discover and book exclusive events, parties, and experiences. GatePass is the premium platform for modern creators and discerning attendees.',
  keywords: ['events', 'tickets', 'nightlife', 'parties', 'gatepass', 'accra', 'ghana', 'experiences'],
  openGraph: {
    title: 'GatePass | The Operating System for Modern Events',
    description: 'Discover and book exclusive events, parties, and experiences.',
    url: '/',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'GatePass — discover events and get tickets' }],
    type: 'website',
    locale: 'en_US',
    siteName: 'GatePass',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GatePass | The Operating System for Modern Events',
    description: 'Discover and book exclusive events, parties, and experiences.',
    images: ['/opengraph-image'],
    creator: '@gatepass_io',
  }
}

async function FeaturedFeed() {
  const events = await getFeaturedEvents()
  return <EventFeed events={events} />
}

export default function Home() {
  return (
    <main className="h-[100dvh] w-full bg-black overflow-hidden relative">
      <Suspense fallback={
        <div className="flex h-[100dvh] items-end justify-end bg-[#09090b] p-4 pb-8 md:p-12" aria-label="Loading events">
          <div className="h-32 w-full rounded-2xl bg-white/10 md:w-[360px]" />
        </div>
      }>
        <FeaturedFeed />
      </Suspense>
      <LandingHeader showAccountMenu={true} />
    </main>
  )
}
