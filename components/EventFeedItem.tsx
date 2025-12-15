'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Event, TicketTier } from '@/types/gatepass'
import { EventBackground } from '@/components/EventBackground'
import { EventDetailClient } from '@/components/EventDetailClient'

interface EventFeedItemProps {
    event: Event
    tiers: TicketTier[]
    isActive: boolean
}

export const EventFeedItem = ({ event, tiers, isActive }: EventFeedItemProps) => {
    return (
        <div className="relative h-full w-full snap-start shrink-0 overflow-hidden bg-black">
            {/* Background (Video/Image) */}
            <EventBackground
                videoUrl={event.video_url}
                posterUrl={event.poster_url}
                forcePause={!isActive}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Event Detail Card (Embedded Mode) */}
            {/* We use isFeedItem to tell the component to use absolute positioning instead of fixed */}
            <EventDetailClient 
                event={event} 
                tiers={tiers} 
                isFeedItem={true} 
            />
        </div>
    )
}
