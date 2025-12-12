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
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero Section */}
      <div className="relative bg-black text-white h-[90vh] flex items-center overflow-hidden">
        {/* Animated Spotlights */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[4s]"></div>
          <div className="absolute top-[10%] right-[20%] w-[400px] h-[400px] bg-amber-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-1000 duration-[5s]"></div>
          <div className="absolute bottom-[-10%] left-[30%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[140px] mix-blend-screen animate-pulse delay-2000 duration-[7s]"></div>
        </div>

        {/* Grain Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

        {/* Radial Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_90%)] z-0"></div>

        {/* Content */}
        <div className="container relative z-10 mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)] animate-fade-in group hover:bg-white/10 transition-colors cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm font-medium text-gray-300 tracking-wide group-hover:text-white transition-colors">The Premium Event Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-9xl font-bold tracking-tighter mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-500 animate-slide-up drop-shadow-2xl">
            Experience<br />
            <span className="bg-gradient-to-r from-gray-100 via-gray-400 to-gray-600 bg-clip-text text-transparent">the Moment.</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed animate-slide-up tracking-wide" style={{ animationDelay: '0.1s' }}>
            Curated events, seamless reservations, and exclusive access.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <button className="relative group overflow-hidden bg-white text-black px-12 py-5 rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_-10px_rgba(255,255,255,0.3)]">
              <span className="relative z-10">Browse Events</span>
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-white to-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
            <button className="group px-10 py-5 rounded-full font-medium text-white hover:text-white transition-all border border-white/10 hover:border-white/30 bg-white/5 backdrop-blur-sm hover:bg-white/10 relative overflow-hidden">
              <span className="relative z-10">View My Tickets</span>
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
            </button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-30 animate-bounce">
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-white to-transparent"></div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="container mx-auto px-4 py-32">
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight mb-4">Upcoming Events</h2>
            <p className="text-muted-foreground text-lg font-light">Don't miss out on what's happening next.</p>
          </div>
          <div className="text-sm font-medium px-4 py-2 bg-gray-100 dark:bg-white/10 rounded-full tabular-nums">
            {events?.length || 0} Events Found
          </div>
        </div>

        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {events.map((event: any) => (
              <Link href={`/events/${event.slug}`} key={event.id} className="block group">
                <EventCard event={event as Event} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-gray-50 dark:bg-zinc-900/30 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h3 className="text-2xl font-bold text-primary mb-2">No events found</h3>
            <p className="text-muted-foreground">Check back later for new experiences.</p>
            {error && (
              <p className="text-red-500 mt-6 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm px-6 inline-block font-mono">
                Error: {error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
