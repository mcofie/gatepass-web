'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { downloadCSV } from '@/utils/analytics'
import { PROVIDERS } from '@/lib/integrations/providers'
import { TransactionDetailModal } from '@/components/admin/TransactionDetailModal'
import { SecondaryButton } from '@/components/dashboard/ui'
import { EmptyState } from '@/components/ui/EmptyState'

const PAGE_SIZE = 20
const RANGES = [
    { id: '7d', label: '7 days', days: 7 },
    { id: '30d', label: '30 days', days: 30 },
    { id: '90d', label: '90 days', days: 90 },
    { id: 'all', label: 'All time', days: null },
] as const
type RangeId = typeof RANGES[number]['id']

type Sale = {
    id: string
    created_at: string
    amount: number
    currency: string
    channel: string | null
    metadata: { provider?: string } | null
    reservations: {
        quantity: number | null
        guest_name: string | null
        guest_email: string | null
        addons: Record<string, number> | null
        profiles: { full_name: string | null; email: string | null } | null
        ticket_tiers: { name: string | null; price: number | null } | null
        events: { id: string; title: string; fee_bearer?: 'customer' | 'organizer' | null } | null
    }
}

const providerName = (sale: Sale) => {
    const id = sale.metadata?.provider
    // Sales before bring-your-own-keys went through GatePass's Paystack account
    if (!id) return 'GatePass'
    return PROVIDERS.find(p => p.category === 'payments' && p.id === id)?.name ?? id
}
const buyerName = (sale: Sale) => sale.reservations.profiles?.full_name || sale.reservations.guest_name || 'Guest'
const buyerEmail = (sale: Sale) => sale.reservations.profiles?.email || sale.reservations.guest_email || ''

export function AllSalesClient({ orgId }: { orgId: string }) {
    const supabase = useMemo(() => createClient(), [])
    const [events, setEvents] = useState<{ id: string; title: string }[]>([])
    const [eventId, setEventId] = useState('all')
    const [range, setRange] = useState<RangeId>('30d')
    const [query, setQuery] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [sales, setSales] = useState<Sale[]>([])
    const [count, setCount] = useState(0)
    // Loading is derived: the request for the current filters hasn't come back yet
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const [summary, setSummary] = useState<{ gross: number; orders: number; tickets: number; currency: string } | null>(null)
    const [exporting, setExporting] = useState(false)
    const [selected, setSelected] = useState<Sale | null>(null)

    // Debounce the search box
    useEffect(() => {
        const timer = setTimeout(() => { setSearch(query.trim()); setPage(0) }, 300)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        supabase.schema('gatepass').from('events').select('id, title').eq('organization_id', orgId).order('starts_at', { ascending: false })
            .then(({ data }) => setEvents(data ?? []))
    }, [supabase, orgId])

    /** The same filters for the table, the summary and the export. */
    const buildQuery = useCallback((select: string, options?: { count?: 'exact' }) => {
        let q = supabase
            .schema('gatepass')
            .from('transactions')
            .select(select, options)
            .eq('status', 'success')
            .eq('reservations.events.organization_id', orgId)
        if (eventId !== 'all') q = q.eq('reservations.event_id', eventId)
        const days = RANGES.find(r => r.id === range)!.days
        if (days) q = q.gte('created_at', new Date(Date.now() - days * 86_400_000).toISOString())
        if (search) {
            const term = search.replace(/[%,()]/g, ' ')
            q = q.or(`guest_name.ilike.%${term}%,guest_email.ilike.%${term}%`, { referencedTable: 'reservations' })
        }
        return q
    }, [supabase, orgId, eventId, range, search])

    const SALE_FIELDS = `
        id, created_at, amount, currency, channel, metadata,
        platform_fee, applied_processor_fee, applied_fee_rate, applied_processor_rate, reservation_id,
        reservations!inner (
            quantity, guest_name, guest_email, addons,
            profiles ( full_name, email ),
            ticket_tiers ( name, price ),
            discounts ( type, value, code ),
            events!inner ( id, title, organization_id, fee_bearer )
        )`

    const requestKey = JSON.stringify({ eventId, range, search, page })
    const loading = loadedKey !== requestKey

    useEffect(() => {
        let active = true
        const start = page * PAGE_SIZE
        Promise.all([
            buildQuery(SALE_FIELDS, { count: 'exact' }).order('created_at', { ascending: false }).range(start, start + PAGE_SIZE - 1),
            buildQuery('amount, currency, reservations!inner ( quantity, guest_name, guest_email, event_id, events!inner ( organization_id ) )'),
        ]).then(([list, totals]) => {
            if (!active) return
            if (list.error) {
                toast.error('Could not load sales')
                console.error(list.error)
            } else {
                setSales((list.data ?? []) as unknown as Sale[])
                setCount(list.count ?? 0)
            }
            const rows = (totals.data ?? []) as unknown as { amount: number; currency: string; reservations: { quantity: number | null } }[]
            setSummary({
                gross: rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
                orders: rows.length,
                tickets: rows.reduce((sum, r) => sum + (r.reservations?.quantity || 1), 0),
                currency: rows[0]?.currency || 'GHS',
            })
            setLoadedKey(requestKey)
        })
        return () => { active = false }
    }, [buildQuery, page, SALE_FIELDS, requestKey])

    const handleExport = async () => {
        setExporting(true)
        const { data, error } = await buildQuery(SALE_FIELDS).order('created_at', { ascending: false }).limit(5000)
        setExporting(false)
        if (error) { toast.error('Export failed'); return }
        const rows = (data ?? []) as unknown as Sale[]
        const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
        const csv = [
            ['Date', 'Buyer', 'Email', 'Event', 'Ticket', 'Quantity', 'Amount', 'Currency', 'Paid via'].join(','),
            ...rows.map(s => [
                s.created_at, buyerName(s), buyerEmail(s), s.reservations.events?.title ?? '', s.reservations.ticket_tiers?.name ?? '',
                s.reservations.quantity ?? 1, s.amount, s.currency, providerName(s),
            ].map(escape).join(',')),
        ].join('\n')
        downloadCSV(csv, `gatepass-sales-${new Date().toISOString().slice(0, 10)}.csv`)
    }

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
    const filtersActive = eventId !== 'all' || range !== 'all' || !!search

    return (
        <div className="space-y-10 pb-16">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                    <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[44px]">Sales</h1>
                    <p className="mt-3 max-w-xl text-[15px] text-gray-500 dark:text-gray-400">Every completed purchase. Money is paid straight into your own payment account.</p>
                </div>
                <SecondaryButton type="button" onClick={handleExport} loading={exporting} disabled={count === 0} className="self-start sm:self-auto">
                    {!exporting && <Download className="size-4" aria-hidden="true" />} Export CSV
                </SecondaryButton>
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 lg:grid-cols-4">
                {[
                    { label: 'Gross sales', value: summary ? formatCurrency(summary.gross, summary.currency) : '…' },
                    { label: 'Orders', value: summary ? summary.orders.toLocaleString() : '…' },
                    { label: 'Tickets', value: summary ? summary.tickets.toLocaleString() : '…' },
                    { label: 'Average order', value: summary ? formatCurrency(summary.orders ? summary.gross / summary.orders : 0, summary.currency) : '…' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white p-5 dark:bg-[#0b0b0b] sm:p-6">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</dt>
                        <dd className="mt-3 truncate text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-gray-950 dark:text-white sm:text-[32px]">{stat.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div role="tablist" aria-label="Date range" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                        {RANGES.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                role="tab"
                                aria-selected={range === r.id}
                                onClick={() => { setRange(r.id); setPage(0) }}
                                className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors ${range === r.id
                                    ? 'bg-gray-950 text-white dark:bg-white dark:text-black'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'}`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label htmlFor="sales-event" className="sr-only">Event</label>
                        <select
                            id="sales-event"
                            value={eventId}
                            onChange={e => { setEventId(e.target.value); setPage(0) }}
                            className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm text-gray-950 outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white sm:max-w-[220px]"
                        >
                            <option value="all">All events</option>
                            {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                        </select>
                        <div className="relative sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input
                                type="search"
                                aria-label="Search buyers"
                                placeholder="Search buyer name or email"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="h-10 w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-950 outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/50"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]" aria-busy={loading}>
                    {loading && sales.length === 0 ? (
                        <div className="flex h-48 items-center justify-center"><Loader2 className="size-5 animate-spin text-gray-400" aria-label="Loading sales" /></div>
                    ) : sales.length === 0 ? (
                        <EmptyState
                            illustration="receipt"
                            title={filtersActive ? 'No sales match these filters' : 'No sales yet'}
                            description={filtersActive ? 'Try a longer date range or another event.' : 'Completed purchases appear here.'}
                        />
                    ) : (
                        <ul className={`divide-y divide-gray-100 dark:divide-white/10 ${loading ? 'opacity-60' : ''}`}>
                            {sales.map(sale => {
                                const r = sale.reservations
                                const addonCount = Object.values(r.addons ?? {}).reduce((sum, qty) => sum + Number(qty || 0), 0)
                                return (
                                    <li key={sale.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelected(sale)}
                                            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-6"
                                        >
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                                {buyerName(sale).charAt(0).toUpperCase()}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-gray-950 dark:text-white">{buyerName(sale)}</span>
                                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                                    {r.events?.title} · {r.quantity ?? 1} × {r.ticket_tiers?.name ?? 'Ticket'}{addonCount ? ` · ${addonCount} add-on${addonCount === 1 ? '' : 's'}` : ''}
                                                </span>
                                            </span>
                                            <span className="hidden w-40 text-sm text-gray-500 dark:text-gray-400 md:block">{formatDateTime(sale.created_at)}</span>
                                            <span className="hidden w-24 lg:block">
                                                <span className="inline-flex rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">{providerName(sale)}</span>
                                            </span>
                                            <span className="w-28 text-right text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(sale.amount, sale.currency)}</span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}

                    {count > PAGE_SIZE && (
                        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-white/10 sm:px-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {page * PAGE_SIZE + 1}–{Math.min(count, (page + 1) * PAGE_SIZE)} of {count.toLocaleString()}
                            </p>
                            <div className="flex gap-1">
                                <button type="button" aria-label="Previous page" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="flex size-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                                    <ChevronLeft className="size-4" />
                                </button>
                                <button type="button" aria-label="Next page" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex size-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <TransactionDetailModal
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                transaction={selected}
                eventFeeBearer={selected?.reservations?.events?.fee_bearer ?? undefined}
            />
        </div>
    )
}
