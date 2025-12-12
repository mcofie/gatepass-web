import { createClient } from '@/utils/supabase/server'
import { EventCard } from '@/components/EventCard'
import Link from 'next/link'
import { Event } from '@/types/gatepass'

export const revalidate = 0 // Disable caching for now to see realtime updates

export default async function Home() {
  const supabase = await createClient()

  const { data: events, error } = await supabase
    .schema('gatepass')
    .from('events')
    .select('id, title, venue_name, starts_at, slug, poster_url')
    .order('starts_at', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-black text-white py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Experience the Moment.</h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Discover the best concerts, festivals, and events happening around you. Secure your spot with Gatepass.
          </p>
          <button className="bg-white text-black px-8 py-3 rounded-full font-bold text-lg hover:bg-gray-100 transition">
            Browse Events
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
          <span className="text-sm text-gray-500">Showing {events?.length || 0} events</span>
        </div>

        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event: any) => (
              <Link href={`/events/${event.slug}`} key={event.id} className="group">
                <EventCard event={event as Event} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No events found</h3>
            <p className="text-gray-500 mt-1">Check back later for new experiences.</p>
            {error && (
              <p className="text-red-500 mt-4 bg-red-50 p-2 rounded text-sm px-4 inline-block">
                Debug: {error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
