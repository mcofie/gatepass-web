import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, MoreHorizontal, Calendar, MapPin } from 'lucide-react'
import { Event } from '@/types/gatepass'
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
            <div className="max-w-7xl mx-auto space-y-8">
                {/* DEBUG: Remove after verifying visibility */}
                {/* <pre className="text-xs bg-red-100 p-2 overflow-auto max-h-40">{JSON.stringify(events, null, 2)}</pre> */}

                {/* Header */}
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Events</h1>
                        <p className="text-gray-500 font-medium mt-1">Manage all your events and ticket sales.</p>
                    </div>
                    <Link href="/dashboard/events/create">
                        <button className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Create Event
                        </button>
                    </Link>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                    {events && events.length > 0 ? (
                        <div className="divide-y divide-gray-50">
                            {events.map((event: any) => (
                                <div key={event.id} className="group p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-gray-50/50 transition-all duration-300">
                                    {/* Event Info */}
                                    <div className="flex items-start gap-6">
                                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs overflow-hidden border border-gray-200 relative">
                                            {event.poster_url ? (
                                                <Image src={event.poster_url} alt="" fill className="object-cover" />
                                            ) : (
                                                <Calendar className="w-6 h-6" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-black transition-colors">{event.title}</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    {event.venue_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status & Actions */}
                                    <div className="flex items-center gap-6 pl-22 sm:pl-0">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${event.is_published
                                            ? 'bg-green-50 text-green-600 border border-green-100'
                                            : 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                                            }`}>
                                            {event.is_published ? 'Live' : 'Draft'}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Link href={`/dashboard/events/${event.id}`}>
                                                <button className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:text-black hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-sm transition-all">
                                                    Manage
                                                </button>
                                            </Link>
                                            <div className="h-6 w-px bg-gray-200" />
                                            <DeleteEventButton eventId={event.id} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-24 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No events yet</h3>
                            <p className="text-gray-500 mb-6">Create your first event to get started.</p>
                            <Link href="/dashboard/events/create">
                                <button className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-800 transition">
                                    Create Event
                                </button>
                            </Link>
                        </div>
                    )}
                </div>
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
