import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Plus, MoreHorizontal, Calendar, MapPin } from 'lucide-react'
import { Event } from '@/types/gatepass'
import { DeleteEventButton } from '@/components/admin/DeleteEventButton'

export const revalidate = 0

export default async function AdminEventsPage() {
    const supabase = await createClient()

    // Fetch all events (Admin view)
    const { data: events, error } = await supabase
        .schema('gatepass')
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching events:', error)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">Events</h1>
                <Link href="/dashboard/events/create">
                    <button className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition">
                        <Plus className="w-4 h-4" /> Create Event
                    </button>
                </Link>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-bold text-gray-900">Event Name</th>
                                <th className="px-6 py-4 font-bold text-gray-900">Venue</th>
                                <th className="px-6 py-4 font-bold text-gray-900">Date</th>
                                <th className="px-6 py-4 font-bold text-gray-900">Status</th>
                                <th className="px-6 py-4 font-bold text-gray-900 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {events && events.length > 0 ? (
                                events.map((event: any) => (
                                    <tr key={event.id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{event.title}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{event.id}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" /> {event.venue_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(event.starts_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.is_published
                                                ? 'bg-green-50 text-green-700'
                                                : 'bg-yellow-50 text-yellow-700'
                                                }`}>
                                                {event.is_published ? 'Published' : 'Draft'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/dashboard/events/${event.id}`}>
                                                    <button className="text-gray-400 hover:text-black transition">
                                                        Manage
                                                    </button>
                                                </Link>
                                                <DeleteEventButton eventId={event.id} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No events found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
