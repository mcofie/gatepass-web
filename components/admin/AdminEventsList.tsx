'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Loader2, Search, Star } from 'lucide-react'
import { setEventFeatured, setEventPublished } from '@/app/actions/admin'
import { AdminCard, AdminEmpty, AdminPill } from '@/components/admin/AdminUI'
import { formatCurrency } from '@/utils/format'

export type AdminEventRow = {
    id: string
    title: string
    slug: string | null
    posterUrl: string | null
    startsAt: string
    organizer: string | null
    organizerId: string | null
    published: boolean
    featured: boolean
    past: boolean
    sold: number
    capacity: number
    sales: number
    currency: string
    billing: 'free' | 'managed' | 'plan' | 'unpaid'
}

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'live', label: 'Live' },
    { id: 'featured', label: 'Featured' },
    { id: 'draft', label: 'Not published' },
    { id: 'past', label: 'Past' },
] as const
type Filter = (typeof FILTERS)[number]['id']

const BILLING: Record<AdminEventRow['billing'], string> = {
    free: 'Free event',
    managed: 'GatePass Payments',
    plan: 'Plan paid',
    unpaid: 'Plan not paid',
}

const PAGE = 50

export function AdminEventsList({ events }: { events: AdminEventRow[] }) {
    const router = useRouter()
    const [rows, setRows] = React.useState(events)
    const [query, setQuery] = React.useState('')
    const [filter, setFilter] = React.useState<Filter>('all')
    const [shown, setShown] = React.useState(PAGE)
    const [busy, setBusy] = React.useState<string | null>(null)

    const q = query.trim().toLowerCase()
    const visible = rows.filter(r => {
        if (q && !`${r.title} ${r.organizer ?? ''}`.toLowerCase().includes(q)) return false
        if (filter === 'live') return r.published && !r.past
        if (filter === 'featured') return r.featured
        if (filter === 'draft') return !r.published
        if (filter === 'past') return r.past
        return true
    })

    const run = async (row: AdminEventRow, action: 'feature' | 'publish') => {
        if (action === 'publish' && !confirm(row.published
            ? `Take “${row.title}” down? It disappears from GatePass and stops selling. Tickets already sold stay valid.`
            : `Publish “${row.title}”? It goes live and can sell tickets.`)) return
        setBusy(`${row.id}-${action}`)
        const res = action === 'feature' ? await setEventFeatured(row.id, !row.featured) : await setEventPublished(row.id, !row.published)
        setBusy(null)
        if (res.error) return toast.error(res.error)
        setRows(list => list.map(r => r.id !== row.id ? r : action === 'feature' ? { ...r, featured: !r.featured } : { ...r, published: !r.published, featured: r.published ? false : r.featured }))
        toast.success(action === 'feature' ? (row.featured ? 'Removed from the home page' : 'Featured on the home page') : (row.published ? 'Event taken down' : 'Event is live again'))
        router.refresh()
    }

    return (
        <AdminCard>
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <label className="relative block sm:w-80">
                    <span className="sr-only">Search events</span>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }} placeholder="Search events or organizers" className="h-10 w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/60" />
                </label>
                <div role="radiogroup" aria-label="Filter events" className="-mx-1 flex gap-1 overflow-x-auto px-1">
                    {FILTERS.map(f => (
                        <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => { setFilter(f.id); setShown(PAGE) }} className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${filter === f.id ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {visible.length === 0 ? <AdminEmpty>{q ? `No events match “${query}”.` : 'No events here.'}</AdminEmpty> : (
                <ul className="divide-y divide-gray-100 dark:divide-white/10">
                    {visible.slice(0, shown).map(row => (
                        <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:flex-nowrap sm:px-6">
                            <Link href={`/admin/events/${row.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
                                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- remote posters */}
                                    {row.posterUrl && <img src={row.posterUrl} alt="" className="size-full object-cover" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-gray-950 hover:underline dark:text-white">{row.title}</span>
                                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                        {[row.organizer ?? 'Deleted organization', new Date(row.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), BILLING[row.billing]].join(' · ')}
                                    </span>
                                </span>
                            </Link>

                            <span className="hidden w-28 shrink-0 text-right md:block">
                                <span className="block text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(row.sales, row.currency)}</span>
                                <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">{row.sold.toLocaleString()}{row.capacity ? ` / ${row.capacity.toLocaleString()}` : ''} sold</span>
                            </span>

                            <span className="flex w-28 shrink-0 justify-start sm:justify-end">
                                {!row.published ? <AdminPill>Not published</AdminPill> : row.past ? <AdminPill>Ended</AdminPill> : <AdminPill tone="live">Live</AdminPill>}
                            </span>

                            <span className="ml-auto flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => run(row, 'feature')}
                                    disabled={!!busy || (!row.published && !row.featured)}
                                    aria-pressed={row.featured}
                                    aria-label={row.featured ? `Unfeature ${row.title}` : `Feature ${row.title}`}
                                    title={row.featured ? 'Featured on the home page' : 'Feature on the home page'}
                                    className={`flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${row.featured ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white'}`}
                                >
                                    {busy === `${row.id}-feature` ? <Loader2 className="size-4 animate-spin" /> : <Star className={`size-4 ${row.featured ? 'fill-current' : ''}`} />}
                                </button>
                                <a href={`/events/${row.slug || row.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.title}`} title="Open event page" className="flex size-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white">
                                    <ExternalLink className="size-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => run(row, 'publish')}
                                    disabled={!!busy}
                                    className={`inline-flex h-9 min-w-[96px] items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${row.published ? 'border-gray-200 text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:text-gray-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'}`}
                                >
                                    {busy === `${row.id}-publish` && <Loader2 className="size-3.5 animate-spin" />}
                                    {row.published ? 'Take down' : 'Publish'}
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {visible.length > shown && (
                <div className="border-t border-gray-100 p-4 text-center dark:border-white/10">
                    <button type="button" onClick={() => setShown(n => n + PAGE)} className="h-9 rounded-full border border-gray-200 px-5 text-sm font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
                        Show more · {(visible.length - shown).toLocaleString()} left
                    </button>
                </div>
            )}
        </AdminCard>
    )
}
