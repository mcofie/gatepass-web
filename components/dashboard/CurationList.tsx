'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Event } from '@/types/gatepass'
import { toast } from 'sonner'
// Using icon as loose representation if no UI component
// actually, I'll build a simple toggle switch UI

interface CurationListProps {
    initialEvents: Event[]
}

export function CurationList({ initialEvents }: CurationListProps) {
    const [events, setEvents] = useState(initialEvents)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const supabase = createClient()

    const toggleFeatured = async (event: Event) => {
        setLoadingId(event.id)
        const newValue = !event.is_featured

        // Optimistic update
        setEvents(events.map(e => e.id === event.id ? { ...e, is_featured: newValue } : e))

        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('events')
                .update({ is_featured: newValue })
                .eq('id', event.id)

            if (error) throw error
            toast.success(newValue ? 'Event featured!' : 'Event removed from featured.')
        } catch (err) {
            console.error('Failed to update featured status:', err)
            // Revert
            setEvents(events.map(e => e.id === event.id ? { ...e, is_featured: !newValue } : e))
            toast.error('Failed to update status.')
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-900">Event</th>
                            <th className="px-6 py-4 font-semibold text-gray-900">Organizer</th>
                            <th className="px-6 py-4 font-semibold text-gray-900">Date</th>
                            <th className="px-6 py-4 font-semibold text-gray-900 text-right">Featured</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {events.map((event) => (
                            <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{event.title}</div>
                                    <div className="text-xs text-gray-500">{event.venue_name}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-600">
                                    {event.organizers?.name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                    {new Date(event.starts_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => toggleFeatured(event)}
                                        disabled={loadingId === event.id}
                                        className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2
                            ${event.is_featured ? 'bg-black' : 'bg-gray-200'}
                        `}
                                    >
                                        <span
                                            className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${event.is_featured ? 'translate-x-6' : 'translate-x-1'}
                            `}
                                        />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {events.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    No events found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
