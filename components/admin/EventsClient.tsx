'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Calendar, MapPin, Search, MoreHorizontal, LayoutGrid, List as ListIcon, Ticket } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { DeleteEventButton } from '@/components/admin/DeleteEventButton'


interface Event {
    id: string
    title: string
    description?: string
    poster_url?: string
    starts_at?: string
    ends_at?: string
    venue_name?: string
    is_published: boolean
    primary_color?: string
    slug: string
    tickets_sold?: number
    revenue?: number
    currency?: string
}

interface EventsClientProps {
    events: Event[]
    role: string | null
}

type TabType = 'all' | 'upcoming' | 'past' | 'draft'

export function EventsClient({ events, role }: EventsClientProps) {
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<TabType>('all')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const isStaff = role === 'Staff'

    const filteredEvents = useMemo(() => {
        const now = new Date()
        return events.filter(event => {
            // Search
            if (search && !event.title.toLowerCase().includes(search.toLowerCase())) {
                return false
            }

            // Tabs
            const startDate = event.starts_at ? new Date(event.starts_at) : null

            if (activeTab === 'draft') return !event.is_published
            if (activeTab === 'upcoming') return event.is_published && startDate && startDate >= now
            if (activeTab === 'past') return event.is_published && startDate && startDate < now

            return true
        })
    }, [events, search, activeTab])

    const stats = {
        total: events.length,
        upcoming: events.filter(e => e.is_published && e.starts_at && new Date(e.starts_at) >= new Date()).length,
        drafts: events.filter(e => !e.is_published).length
    }

    return (
        <div className="mx-auto max-w-[1180px] space-y-7 pb-16">
            {/* Header Area */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                    <h1 className="text-[32px] font-semibold tracking-tight text-gray-950 dark:text-white sm:text-[38px]">Events</h1>
                    <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                        {isStaff
                            ? "View and manage events for your organization."
                            : "Manage your events, track sales, and customize your ticketing pages."}
                    </p>
                </div>
                {!isStaff && (
                    <Link href="/dashboard/events/create" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black">
                        <Plus className="h-4 w-4" /> Create event
                    </Link>
                )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto self-stretch md:self-auto">
                    {(['all', 'upcoming', 'past', 'draft'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            aria-pressed={activeTab === tab}
                            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors capitalize ${activeTab === tab
                                ? 'bg-gray-100 text-black dark:bg-white/10 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                }`}
                        >
                            {tab === 'all' ? 'All Events' : tab}
                        </button>
                    ))}
                </div>

                <div className="flex w-full items-center gap-2 md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search events"
                            aria-label="Search events"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition-colors focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:focus:border-white/40"
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex rounded-lg border border-gray-200 p-1 dark:border-white/10">
                        <button
                            onClick={() => setViewMode('grid')}
                            aria-label="Grid view"
                            aria-pressed={viewMode === 'grid'}
                            className={`rounded-md p-2 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-black dark:bg-white/10 dark:text-white' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            aria-label="List view"
                            aria-pressed={viewMode === 'list'}
                            className={`rounded-md p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-black dark:bg-white/10 dark:text-white' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {filteredEvents.length > 0 ? (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredEvents.map((event) => (
                            <EventCard key={event.id} event={event} isStaff={isStaff} />
                        ))}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-white/10">
                                    <tr>
                                        <th className="px-6 py-4">Event</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Venue</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Activity</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                    {filteredEvents.map(event => (
                                        <EventRow key={event.id} event={event} isStaff={isStaff} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-20 text-center dark:border-white/10 dark:bg-[#111]">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">No events found</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                        {search ? `No results for "${search}"` : `No ${activeTab} events found.`}
                    </p>
                    {(activeTab !== 'all' || search) && (
                        <button
                            onClick={() => { setSearch(''); setActiveTab('all') }}
                            className="mt-6 text-sm font-semibold text-gray-900 underline underline-offset-4 dark:text-white"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

function EventCard({ event, isStaff }: { event: Event, isStaff: boolean }) {
    const isPast = event.ends_at ? new Date(event.ends_at) < new Date() : false

    return (
        <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-400 dark:border-white/10 dark:bg-[#111] dark:hover:border-white/30">
            {/* Poster Aspect Ratio */}
            <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-white/5">
                {event.poster_url ? (
                    <Image
                        src={event.poster_url}
                        alt={event.title}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/10">
                        <Calendar className="w-12 h-12" />
                    </div>
                )}

                <div className="absolute right-3 top-3">
                    <div className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-900 dark:bg-black dark:text-white">
                        {event.is_published ? (isPast ? 'Ended' : 'Live') : 'Draft'}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="line-clamp-1 text-lg font-semibold text-gray-900 dark:text-white">
                        {event.title}
                    </h3>
                </div>

                <div className="mb-6 space-y-2">
                    <div className="flex items-center gap-2.5 text-sm text-gray-500 font-medium dark:text-gray-400">
                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                        <span>
                            {event.starts_at ? new Date(event.starts_at).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-gray-500 font-medium dark:text-gray-400">
                        <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                        <span className="truncate">{event.venue_name || 'Venue TBD'}</span>
                    </div>
                </div>

                {/* Mini Stats Row */}
                <div className="mt-auto grid grid-cols-2 gap-4 border-t border-gray-100 pb-4 pt-4 dark:border-white/10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sold</span>
                        <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold">
                            <Ticket className="w-3.5 h-3.5 text-gray-400" />
                            {event.tickets_sold || 0}
                        </div>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revenue</span>
                        <span className="text-gray-900 dark:text-white font-bold tabular-nums">
                            {formatCurrency(event.revenue || 0, event.currency || 'GHS')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/events/${event.id}`} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                        Manage
                    </Link>
                    {!isStaff && (
                        <div className="w-10 h-10 flex items-center justify-center">
                            <DeleteEventButton eventId={event.id} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function EventRow({ event, isStaff }: { event: Event, isStaff: boolean }) {
    return (
        <tr className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
            <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-white/10 relative overflow-hidden flex-shrink-0">
                        {event.poster_url && (
                            <Image src={event.poster_url} alt="" fill className="object-cover" />
                        )}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{event.title}</h4>
                        <Link href={`/events/${event.slug}`} target="_blank" className="text-xs text-gray-500 underline-offset-2 hover:underline dark:text-gray-400">
                            View Live Page
                        </Link>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                {event.starts_at ? new Date(event.starts_at).toLocaleDateString('en-GB') : 'TBD'}
            </td>
            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                {event.venue_name || 'TBD'}
            </td>
            <td className="px-6 py-4">
                <span className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">
                    {event.is_published ? 'Live' : 'Draft'}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex flex-col items-end">
                    <span className="font-bold text-gray-900 dark:text-white">{event.tickets_sold || 0} sold</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {formatCurrency(event.revenue || 0, event.currency || 'GHS')}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <Link href={`/dashboard/events/${event.id}`} aria-label={`Manage ${event.title}`} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-white/10">
                        <MoreHorizontal className="h-4 w-4" />
                    </Link>
                </div>
            </td>
        </tr>
    )
}
