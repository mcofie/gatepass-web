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

    // 1. Determine Organization Context and Role
    // Check if owner
    let { data: org } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('id')
        .eq('user_id', user.id)
        .single()

    let role = org ? 'Owner' : null
    let orgId = org?.id

    // If not owner, check if team member
    if (!org) {
        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .single()

        if (teamMember) {
            orgId = teamMember.organization_id
            role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
        }
    }

    if (!orgId) {
        return (
            <div className="max-w-7xl mx-auto py-12 text-center">
                <h2 className="text-2xl font-bold">No Organization Found</h2>
                <p className="mb-4 text-gray-500">You need to be part of an organization to manage events.</p>
                <Link href="/onboarding" className="text-blue-600 hover:underline">Go to Onboarding</Link>
            </div>
        )
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

        console.log(`[Dashboard] Fetching events for organization: ${orgId}`)

        const { data: events, error } = await adminSupabase
            .schema('gatepass')
            .from('events')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })

        const isStaff = role === 'Staff'

        console.log(`[Dashboard] Found ${events?.length || 0} events`)

        return (
            <div className="max-w-7xl mx-auto space-y-12 pb-24">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-2">Events</h1>
                        <p className="text-gray-500 font-medium text-lg max-w-xl dark:text-gray-400">
                            {isStaff
                                ? "View and manage events for your organization."
                                : "Manage your events, track sales, and customize your ticketing pages."}
                        </p>
                    </div>
                    {!isStaff && (
                        <Link href="/dashboard/events/create">
                            <button className="bg-black dark:bg-white dark:text-black text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-none hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5">
                                <Plus className="w-5 h-5" /> Create Event
                            </button>
                        </Link>
                    )}
                </div>

                {events && events.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {events.map((event: any) => (
                            <div key={event.id} className="group bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-300 flex flex-col h-full ring-1 ring-black/0 hover:ring-black/5 dark:hover:ring-white/10">
                                {/* Poster Aspect Ratio */}
                                <div className="relative aspect-[4/3] bg-gray-100 dark:bg-white/5 overflow-hidden">
                                    {event.poster_url ? (
                                        <Image
                                            src={event.poster_url}
                                            alt={event.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/20">
                                            <Calendar className="w-12 h-12" />
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {/* Theme Color Indicator */}
                                        <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: event.primary_color || '#000000' }} />

                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border flex items-center ${event.is_published
                                            ? 'bg-green-500/90 text-white border-white/20'
                                            : 'bg-yellow-400/90 text-black border-white/20'
                                            }`}>
                                            {event.is_published ? 'Live' : 'Draft'}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6 flex-1 flex flex-col">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{event.title}</h3>

                                    <div className="space-y-2 mb-8">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium dark:text-gray-400">
                                            <Calendar className="w-4 h-4 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
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
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium dark:text-gray-400">
                                            <MapPin className="w-4 h-4 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                                            <span className="truncate">{event.venue_name || 'Venue TBD'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center gap-3 pt-6 border-t border-gray-100 dark:border-white/10">
                                        <Link href={`/dashboard/events/${event.id}`} className="flex-1">
                                            <button className="w-full py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                                                {isStaff ? 'View Sales' : 'Manage'}
                                            </button>
                                        </Link>
                                        {!isStaff && <DeleteEventButton eventId={event.id} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 border-dashed animate-fade-in">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10">
                            <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No events created</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">Get started by creating your first event. It only takes a few minutes.</p>
                        <Link href="/dashboard/events/create">
                            <button className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5">
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
