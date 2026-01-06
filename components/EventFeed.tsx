'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EventFeedItem } from '@/components/EventFeedItem'
import { Event, TicketTier } from '@/types/gatepass'

interface EventFeedProps {
    events: (Event & { ticket_tiers: TicketTier[] })[]
}

export const EventFeed = ({ events }: EventFeedProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const searchParams = useSearchParams()
    const eventId = searchParams.get('event_id')

    // Handle Callback Auto-scroll
    useEffect(() => {
        if (eventId && events.length > 0) {
            const index = events.findIndex(e => e.id === eventId)
            if (index !== -1) {
                console.log(`[EventFeed] Auto-scrolling to event ${eventId} at index ${index}`)
                setActiveIndex(index)

                // Jump to the item immediately
                setTimeout(() => {
                    const container = containerRef.current
                    const target = container?.querySelector(`[data-index="${index}"]`)
                    if (target) {
                        target.scrollIntoView({ behavior: 'auto', block: 'start' })
                    }
                }, 100) // Small delay to ensure DOM is ready
            }
        }
    }, [eventId, events])

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
            <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center bg-[#09090b] text-white overflow-hidden">
                {/* Subtle Grain/Texture Overlay (Optional, keep clean for now) */}

                <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg mx-auto">
                    {/* Minimal Icon */}
                    <div className="mb-6 text-white/20 animate-fade-in transition-transform duration-500 hover:scale-110 hover:text-white/40 cursor-default">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="64"
                            height="64"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                            <line x1="16" x2="16" y1="2" y2="6" />
                            <line x1="8" x2="8" y1="2" y2="6" />
                            <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white animate-slide-up">
                        No Upcoming Events
                    </h1>

                    <p className="text-zinc-500 text-base md:text-lg font-medium leading-relaxed mb-8 max-w-sm mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        The curated list is currently empty. Check back soon for exclusive access.
                    </p>

                    <div className="animate-slide-up flex flex-col gap-4 items-center" style={{ animationDelay: '0.2s' }}>
                        <div className="h-px w-12 bg-[#d4af37]" /> {/* Gold Accent */}
                        <span className="text-[10px] font-bold tracking-[0.3em] text-[#d4af37] uppercase">GatePass</span>
                    </div>
                </div>
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
