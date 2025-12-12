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
    const formattedDate = formatDate(event.starts_at)

    return (
        <div className="group h-full flex flex-col bg-white dark:bg-zinc-900/50 rounded-3xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-500">
            {/* Image Container */}
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-zinc-800">
                <img
                    src={event.poster_url || 'https://placehold.co/800x600'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    alt="Event Poster"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                <div className="absolute top-4 left-4 bg-white/95 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm border border-white/10">
                    {formattedDate}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-bold text-primary leading-tight mb-3 line-clamp-2 group-hover:text-amber-500/90 transition-colors">
                        {event.title}
                    </h3>
                    <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {event.venue_name}
                    </p>
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">Reserve Spot</span>
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black transform translate-x-0 group-hover:translate-x-2 transition-transform">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 6h10" />
                            <path d="M7 2l4 4-4 4" />
                        </svg>
                    </span>
                </div>
            </div>
        </div>
    )
}
