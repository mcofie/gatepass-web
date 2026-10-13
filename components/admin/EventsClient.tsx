'use client'

import React, { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Calendar, LayoutGrid, List as ListIcon, Plus, Search, X } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { DeleteEventButton } from '@/components/admin/DeleteEventButton'
import { EmptyState } from '@/components/ui/EmptyState'

interface Event {
    id: string
    title: string
    poster_url?: string
    starts_at?: string
    ends_at?: string
    publish_at?: string | null
    venue_name?: string
    is_published: boolean
    slug: string
    tier_count?: number
    tickets_sold?: number
    capacity?: number | null
    revenue?: number
    currency?: string
}

type Status = 'live' | 'scheduled' | 'draft' | 'ended'
type Filter = 'all' | 'live' | 'upcoming' | 'draft' | 'past'

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'live', label: 'On sale' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'draft', label: 'Drafts' },
    { id: 'past', label: 'Past' },
]

const STATUS_LABEL: Record<Status, string> = { live: 'On sale', scheduled: 'Scheduled', draft: 'Draft', ended: 'Ended' }
const STATUS_DOT: Record<Status, string> = {
    live: 'bg-emerald-500',
    scheduled: 'bg-sky-500',
    draft: 'bg-gray-300 dark:bg-white/30',
    ended: 'bg-gray-400 dark:bg-white/40',
}

/** An event has ended once its end (or, without one, its start) is in the past. */
function getStatus(event: Event, now: number): Status {
    const end = event.ends_at ?? event.starts_at
    if (end && new Date(end).getTime() < now) return 'ended'
    if (event.is_published) return 'live'
    if (event.publish_at) return 'scheduled'
    return 'draft'
}

function formatWhen(iso?: string) {
    if (!iso) return 'Date to be set'
    const date = new Date(iso)
    const sameYear = date.getFullYear() === new Date().getFullYear()
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
        + ' · ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Remembered list/grid preference (per browser)
const VIEW_KEY = 'gatepass:events-view'
const VIEW_EVENT = 'gatepass:events-view-change'

function readView(): 'list' | 'grid' {
    try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list' } catch { return 'list' }
}
function writeView(view: 'list' | 'grid') {
    try { localStorage.setItem(VIEW_KEY, view) } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(VIEW_EVENT))
}
function subscribeView(onChange: () => void) {
    window.addEventListener(VIEW_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
        window.removeEventListener(VIEW_EVENT, onChange)
        window.removeEventListener('storage', onChange)
    }
}

export function EventsClient({ events, role }: { events: Event[]; role: string | null }) {
    const isStaff = role === 'Staff'
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<Filter>('all')
    const view = useSyncExternalStore(subscribeView, readView, () => 'list' as const)
    // Evaluated once so every row agrees on "now"
    const [now] = useState(() => Date.now())

    const withStatus = useMemo(() => events.map(e => ({ ...e, status: getStatus(e, now) })), [events, now])

    const counts = useMemo(() => ({
        all: withStatus.length,
        live: withStatus.filter(e => e.status === 'live').length,
        upcoming: withStatus.filter(e => e.status !== 'ended' && e.starts_at && new Date(e.starts_at).getTime() >= now).length,
        draft: withStatus.filter(e => e.status === 'draft' || e.status === 'scheduled').length,
        past: withStatus.filter(e => e.status === 'ended').length,
    }), [withStatus, now])

    const summary = useMemo(() => {
        const sold = withStatus.reduce((acc, e) => acc + (e.tickets_sold || 0), 0)
        // Gross per currency; the headline shows the main one
        const byCurrency = new Map<string, number>()
        for (const e of withStatus) byCurrency.set(e.currency || 'GHS', (byCurrency.get(e.currency || 'GHS') ?? 0) + (e.revenue || 0))
        const [currency, gross] = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['GHS', 0]
        return { sold, gross, currency, otherCurrencies: byCurrency.size > 1 }
    }, [withStatus])

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase()
        const list = withStatus.filter(e => {
            if (query && !`${e.title} ${e.venue_name ?? ''}`.toLowerCase().includes(query)) return false
            const start = e.starts_at ? new Date(e.starts_at).getTime() : null
            switch (filter) {
                case 'live': return e.status === 'live'
                case 'upcoming': return e.status !== 'ended' && start !== null && start >= now
                case 'draft': return e.status === 'draft' || e.status === 'scheduled'
                case 'past': return e.status === 'ended'
                default: return true
            }
        })
        const time = (e: Event) => (e.starts_at ? new Date(e.starts_at).getTime() : Infinity)
        // Past: most recent first. Everything else: soonest first, undated last
        return list.sort((a, b) => filter === 'past' ? time(b) - time(a) : time(a) - time(b))
    }, [withStatus, search, filter, now])

    if (events.length === 0) return <FirstEvent isStaff={isStaff} />

    return (
        <div className="space-y-10 pb-16">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                    <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[44px]">Events</h1>
                </div>
                {!isStaff && (
                    <Link href="/dashboard/events/create" className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-gray-950 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black sm:self-auto">
                        <Plus className="size-4" aria-hidden="true" /> New event
                    </Link>
                )}
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 lg:grid-cols-4">
                {[
                    { label: 'On sale', value: counts.live.toLocaleString() },
                    { label: 'Upcoming', value: counts.upcoming.toLocaleString() },
                    { label: 'Tickets sold', value: summary.sold.toLocaleString() },
                    { label: summary.otherCurrencies ? `Gross sales (${summary.currency})` : 'Gross sales', value: formatCurrency(summary.gross, summary.currency) },
                ].map(stat => (
                    <div key={stat.label} className="bg-white p-5 dark:bg-[#0b0b0b] sm:p-6">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</dt>
                        <dd className="mt-3 truncate text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-gray-950 dark:text-white sm:text-[32px]">{stat.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div role="tablist" aria-label="Filter events" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                        {FILTERS.map(f => (
                            <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={filter === f.id}
                                onClick={() => setFilter(f.id)}
                                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${filter === f.id
                                    ? 'bg-gray-950 text-white dark:bg-white dark:text-black'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'}`}
                            >
                                {f.label}
                                <span className={`tabular-nums text-xs ${filter === f.id ? 'opacity-60' : 'text-gray-400 dark:text-gray-500'}`}>{counts[f.id]}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 lg:w-72 lg:flex-none">
                            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input
                                type="search"
                                placeholder="Search by name or venue"
                                aria-label="Search events"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-10 w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition-colors focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/50"
                            />
                        </div>
                        <div className="flex rounded-full border border-gray-200 p-1 dark:border-white/10" role="group" aria-label="Layout">
                            {([['list', ListIcon], ['grid', LayoutGrid]] as const).map(([mode, Icon]) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => writeView(mode)}
                                    aria-label={`${mode === 'list' ? 'List' : 'Grid'} view`}
                                    aria-pressed={view === mode}
                                    className={`rounded-full p-1.5 transition-colors ${view === mode ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-400 hover:text-gray-950 dark:hover:text-white'}`}
                                >
                                    <Icon className="size-4" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {visible.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-gray-300 dark:border-white/15">
                        <EmptyState
                            illustration="calendar"
                            title={search ? `Nothing matches “${search}”` : `No ${FILTERS.find(f => f.id === filter)!.label.toLowerCase()} events`}
                            action={
                                <button type="button" onClick={() => { setSearch(''); setFilter('all') }} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-950 underline underline-offset-4 dark:text-white">
                                    <X className="size-3.5" aria-hidden="true" /> Clear filters
                                </button>
                            }
                        />
                    </div>
                ) : view === 'list' ? (
                    <ul className="divide-y divide-gray-200 overflow-hidden rounded-3xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#0b0b0b]">
                        {visible.map(event => <EventRow key={event.id} event={event} isStaff={isStaff} />)}
                    </ul>
                ) : (
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {visible.map(event => <EventCard key={event.id} event={event} isStaff={isStaff} />)}
                    </ul>
                )}
            </div>
        </div>
    )
}

function StatusPill({ status }: { status: Status }) {
    return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-700 dark:border-white/10 dark:bg-black dark:text-gray-300">
            <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
            {STATUS_LABEL[status]}
        </span>
    )
}

function SoldBar({ sold, capacity }: { sold: number; capacity: number | null | undefined }) {
    const pct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0
    return (
        <div className="w-full">
            <p className="text-sm tabular-nums text-gray-950 dark:text-white">
                <span className="font-semibold">{sold.toLocaleString()}</span>
                <span className="text-gray-500 dark:text-gray-400">{capacity ? ` / ${capacity.toLocaleString()}` : ' sold'}</span>
            </p>
            {capacity ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tickets sold">
                    <div className="h-full rounded-full bg-gray-950 dark:bg-white" style={{ width: `${pct}%` }} />
                </div>
            ) : null}
        </div>
    )
}

function Poster({ event, className }: { event: Event; className: string }) {
    return (
        <div className={`relative overflow-hidden bg-gray-100 dark:bg-white/5 ${className}`}>
            {event.poster_url
                ? <Image src={event.poster_url} alt="" fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-white/15"><Calendar className="size-5" aria-hidden="true" /></div>}
        </div>
    )
}

function EventRow({ event, isStaff }: { event: Event & { status: Status }; isStaff: boolean }) {
    return (
        <li className="group relative flex items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-6">
            <Poster event={event} className="size-14 shrink-0 rounded-xl sm:size-16" />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/events/${event.id}`} className="truncate text-[15px] font-semibold text-gray-950 after:absolute after:inset-0 dark:text-white">
                        {event.title}
                    </Link>
                    <span className="hidden sm:inline-flex"><StatusPill status={event.status} /></span>
                </div>
                <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                    {formatWhen(event.starts_at)}{event.venue_name ? ` · ${event.venue_name}` : ''}
                </p>
                {event.status === 'draft' && !event.tier_count && (
                    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">Add tickets to publish</p>
                )}
                <span className="mt-2 inline-flex sm:hidden"><StatusPill status={event.status} /></span>
            </div>

            <div className="hidden w-36 md:block"><SoldBar sold={event.tickets_sold || 0} capacity={event.capacity} /></div>

            <p className="hidden w-32 text-right text-sm font-semibold tabular-nums text-gray-950 dark:text-white lg:block">
                {formatCurrency(event.revenue || 0, event.currency || 'GHS')}
            </p>

            {/* Above the row link so they stay clickable */}
            <div className="relative z-10 flex items-center gap-1">
                {event.is_published && (
                    <Link href={`/events/${event.slug}`} target="_blank" aria-label={`Open ${event.title} event page`} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white">
                        <ArrowUpRight className="size-4" />
                    </Link>
                )}
                {!isStaff && <DeleteEventButton eventId={event.id} />}
            </div>
        </li>
    )
}

function EventCard({ event, isStaff }: { event: Event & { status: Status }; isStaff: boolean }) {
    return (
        <li className="group relative flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white transition-colors hover:border-gray-950 dark:border-white/10 dark:bg-[#0b0b0b] dark:hover:border-white/50">
            <Poster event={event} className="aspect-[16/10]" />
            <div className="absolute left-3 top-3"><StatusPill status={event.status} /></div>
            <div className="flex flex-1 flex-col p-5">
                <Link href={`/dashboard/events/${event.id}`} className="line-clamp-1 text-lg font-semibold tracking-tight text-gray-950 after:absolute after:inset-0 dark:text-white">
                    {event.title}
                </Link>
                <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{formatWhen(event.starts_at)}</p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">{event.venue_name || 'Venue to be set'}</p>
                <div className="mt-5 flex items-end justify-between gap-4 border-t border-gray-100 pt-4 dark:border-white/10">
                    <div className="w-28"><SoldBar sold={event.tickets_sold || 0} capacity={event.capacity} /></div>
                    <p className="text-right text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(event.revenue || 0, event.currency || 'GHS')}</p>
                </div>
            </div>
            {!isStaff && <div className="absolute right-3 top-3 z-10 rounded-full bg-white/90 dark:bg-black/80"><DeleteEventButton eventId={event.id} /></div>}
        </li>
    )
}

function FirstEvent({ isStaff }: { isStaff: boolean }) {
    const steps = [
        { title: 'Create the event', detail: 'Title, date, venue and a poster or video.' },
        { title: 'Add tickets', detail: 'Tiers, add-ons, promo codes and payment plans.' },
        { title: 'Publish', detail: 'Pay the one-time plan fee if it applies, then share your link.' },
    ]
    return (
        <div className="grid gap-10 pb-16 lg:grid-cols-[1fr_420px] lg:gap-16">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Events</p>
                <h1 className="mt-3 text-[40px] font-semibold leading-[1.02] tracking-[-0.05em] text-gray-950 dark:text-white sm:text-[56px]">Your first event starts here.</h1>
                <p className="mt-5 max-w-md text-[15px] leading-7 text-gray-500 dark:text-gray-400">
                    {isStaff ? 'No events yet. An owner or admin can create one.' : 'Set it up in a few minutes. Ticket money goes straight to your own payment account.'}
                </p>
                {!isStaff && (
                    <Link href="/dashboard/events/create" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gray-950 px-6 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black">
                        <Plus className="size-4" aria-hidden="true" /> Create event
                    </Link>
                )}
            </div>
            <ol className="self-end border-t border-gray-200 dark:border-white/10">
                {steps.map((step, i) => (
                    <li key={step.title} className="grid grid-cols-[2.5rem_1fr] border-b border-gray-200 py-5 dark:border-white/10">
                        <span className="font-mono text-sm tabular-nums text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                        <div>
                            <p className="font-medium text-gray-950 dark:text-white">{step.title}</p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{step.detail}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    )
}
