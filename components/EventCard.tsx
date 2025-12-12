'use client'

import React from 'react'
import { Event } from '@/types/gatepass'
import { MapPin } from 'lucide-react'

interface EventCardProps {
    event: Event
}

const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'TBA'
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        })
    } catch (e) {
        return 'Invalid Date'
    }
}

export function EventCard({ event }: EventCardProps) {
    return (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col group">
            <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
                <img
                    src={event.poster_url || 'https://placehold.co/800x450'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt="Event Poster"
                />

                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                    {formatDate(event.starts_at)}
                </div>
            </div>

            <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2 line-clamp-2">
                        {event.title}
                    </h3>
                    <p className="text-gray-500 text-sm font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.venue_name}
                    </p>
                </div>

                <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm">
                    <span className="font-medium text-black">Get Tickets &rarr;</span>
                </div>
            </div>
        </div>
    )
}
