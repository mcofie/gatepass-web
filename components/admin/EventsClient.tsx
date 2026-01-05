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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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
                        <button className="bg-black dark:bg-white dark:text-black text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-none hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            <span>Create Event</span>
                        </button>
                    </Link>
                )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-[#111] p-2 pr-4 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm sticky top-4 z-30">
                {/* Tabs */}
                <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-2xl self-stretch md:self-auto">
                    {(['all', 'upcoming', 'past', 'draft'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${activeTab === tab
                                ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                }`}
                        >
                            {tab === 'all' ? 'All Events' : tab}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:bg-white dark:focus:bg-black focus:border-gray-200 dark:focus:border-white/20 outline-none transition-all text-sm font-medium"
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl border border-gray-200/50 dark:border-white/5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {filteredEvents.length > 0 ? (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredEvents.map((event) => (
                            <EventCard key={event.id} event={event} isStaff={isStaff} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
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
                <div className="flex flex-col items-center justify-center py-32 text-center bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/10 border-dashed">
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
                            className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
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
        <div className="group bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-500 flex flex-col h-full hover:-translate-y-1">
            {/* Poster Aspect Ratio */}
            <div className="relative aspect-[16/10] bg-gray-100 dark:bg-white/5 overflow-hidden">
                {event.poster_url ? (
                    <Image
                        src={event.poster_url}
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/10">
                        <Calendar className="w-12 h-12" />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500" />

                <div className="absolute top-4 right-4 flex gap-2">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10 shadow-lg ${event.is_published
                        ? isPast
                            ? 'bg-gray-900/90 text-gray-300'
                            : 'bg-green-500/90 text-white'
                        : 'bg-yellow-400/90 text-black'
                        }`}>
                        {event.is_published ? (isPast ? 'Ended' : 'Live') : 'Draft'}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {event.title}
                    </h3>
                </div>

                <div className="space-y-3 mb-8">
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
                <div className="mt-auto pt-6 border-t border-gray-100 dark:border-white/10 grid grid-cols-2 gap-4 pb-4">
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
                    <Link href={`/dashboard/events/${event.id}`} className="flex-1">
                        <button className="w-full h-10 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 border border-transparent hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-transparent hover:text-black dark:hover:text-white transition-all">
                            Manage
                        </button>
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
                        <Link href={`/events/${event.slug}`} target="_blank" className="text-xs text-blue-600 hover:underline">
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
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${event.is_published
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                    }`}>
                    {event.is_published ? 'Live' : 'Draft'}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex flex-col items-end">
                    <span className="font-bold text-gray-900 dark:text-white">{event.tickets_sold || 0} sold</span>
                    <span className="text-xs text-green-600 font-medium">
                        {formatCurrency(event.revenue || 0, event.currency || 'GHS')}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/dashboard/events/${event.id}`}>
                        <button className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                            <MoreHorizontal className="w-4 h-4" />
                        </button>
                    </Link>
                </div>
            </td>
        </tr>
    )
}
