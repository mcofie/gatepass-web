import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Calendar, MapPin } from 'lucide-react'
import { DeleteEventButton } from '@/components/admin/DeleteEventButton'

export const revalidate = 0

export default async function AdminEventsPage() {
    const supabase = await createClient()

    // Fetch all events (Admin view)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Should be handled by middleware, but safe fallback
        return <div>Please log in to view events.</div>
    }

    try {
        // Fetch user's events using Admin Client to bypass potential RLS issues
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY')
            throw new Error('Server configuration error: Missing Service Key')
        }

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        console.log(`[Dashboard] Fetching events for organizer: ${user.id}`)

        const { data: events, error } = await adminSupabase
            .schema('gatepass')
            .from('events')
            .select('*')
            .eq('organizer_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[Dashboard] Supabase Fetch Error:', error)
            throw error
        }

        console.log(`[Dashboard] Found ${events?.length || 0} events`)

        return (
            <div className="max-w-7xl mx-auto space-y-12 pb-24">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">Events</h1>
                        <p className="text-gray-500 font-medium text-lg max-w-xl">Manage your events, track sales, and customize your ticketing pages.</p>
                    </div>
                    <Link href="/dashboard/events/create">
                        <button className="bg-black text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5">
                            <Plus className="w-5 h-5" /> Create Event
                        </button>
                    </Link>
                </div>

                {events && events.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {events.map((event: any) => (
                            <div key={event.id} className="group bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-300 flex flex-col h-full ring-1 ring-black/0 hover:ring-black/5">
                                {/* Poster Aspect Ratio */}
                                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                                    {event.poster_url ? (
                                        <Image
                                            src={event.poster_url}
                                            alt={event.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Calendar className="w-12 h-12" />
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border ${event.is_published
                                            ? 'bg-green-500/90 text-white border-white/20'
                                            : 'bg-yellow-400/90 text-black border-white/20'
                                            }`}>
                                            {event.is_published ? 'Live' : 'Draft'}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6 flex-1 flex flex-col">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">{event.title}</h3>

                                    <div className="space-y-2 mb-8">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>
                                                {event.starts_at ? (
                                                    <>
                                                        {new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        {event.ends_at && new Date(event.starts_at).toDateString() !== new Date(event.ends_at).toDateString() && (
                                                            <> - {new Date(event.ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>
                                                        )}
                                                    </>
                                                ) : 'Date TBD'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span className="truncate">{event.venue_name || 'Venue TBD'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center gap-3 pt-6 border-t border-gray-100">
                                        <Link href={`/dashboard/events/${event.id}`} className="flex-1">
                                            <button className="w-full py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-50 hover:bg-black hover:text-white transition-all">
                                                Manage
                                            </button>
                                        </Link>
                                        <DeleteEventButton eventId={event.id} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-32 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                        <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400 shadow-inner">
                            <Calendar className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">No events created</h3>
                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">Get started by creating your first event. It only takes a few minutes.</p>
                        <Link href="/dashboard/events/create">
                            <button className="bg-black text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition">
                                Create Event
                            </button>
                        </Link>
                    </div>
                )}
            </div>
        )
    } catch (error: any) {
        console.error('Fatal Dashboard Error:', error)
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 font-bold mb-2">Failed to load events</div>
                <pre className="text-xs text-left bg-gray-100 p-4 rounded overflow-auto max-w-lg mx-auto">
                    {error.message || JSON.stringify(error)}
                </pre>
            </div>
        )
    }
}
