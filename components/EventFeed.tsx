'use client'

import React, { useEffect, useRef, useState } from 'react'
import { EventFeedItem } from '@/components/EventFeedItem'
import { Event, TicketTier } from '@/types/gatepass'

interface EventFeedProps {
    events: (Event & { ticket_tiers: TicketTier[] })[]
}

export const EventFeed = ({ events }: EventFeedProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = Number(entry.target.getAttribute('data-index'))
                    setActiveIndex(index)
                }
            })
        }, {
            threshold: 0.6 // 60% visibility required to be "active"
        })

        const items = container.querySelectorAll('.event-feed-item')
        items.forEach(item => observer.observe(item))

        return () => observer.disconnect()
    }, [events])

    if (events.length === 0) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-black text-white">
                <p>No active events found.</p>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black no-scrollbar"
        >
            {events.map((event, index) => {
                // Lazy Rendering: Only render the current item and its immediate neighbors (+/- 1)
                // This keeps 3 items in the DOM at most (Active, Prev, Next)
                const shouldRender = Math.abs(activeIndex - index) <= 1

                return (
                    <div
                        key={event.id}
                        data-index={index}
                        className="event-feed-item h-[100dvh] w-full snap-start relative"
                    >
                        {shouldRender ? (
                            <EventFeedItem
                                event={event}
                                tiers={event.ticket_tiers || []}
                                isActive={activeIndex === index}
                            />
                        ) : (
                            // Lightweight placeholder to maintain scroll height/snap
                            <div className="w-full h-full bg-black" />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
