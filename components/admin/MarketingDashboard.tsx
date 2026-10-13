'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import {
    Copy,
    Check,
    Search,
    Download,
    Trash2,
    Send,
    Loader2,
} from 'lucide-react'
import { sendSMSBlast } from '@/app/actions/communications'
import { toast } from 'sonner'
import { formatCompactNumber, formatCompactCurrency } from '@/utils/format'

interface MarketingStat {
    id: string
    event_id: string
    utm_source: string
    utm_medium: string | null
    utm_campaign: string | null
    views: number
    checkouts: number
    transactions: number
    revenue: number
    currency: string
    last_viewed_at: string
    events: {
        id: string
        title: string
        organization_id: string
    }
}

interface EventOption {
    id: string
    title: string
    slug: string
}

interface MarketingDashboardProps {
    initialStats: MarketingStat[]
    events: EventOption[]
    organizationId: string
}

export function MarketingDashboard({ initialStats, events, organizationId }: MarketingDashboardProps) {
    const [search, setSearch] = useState('')
    const [selectedEventId, setSelectedEventId] = useState<string>('all')
    const [copied, setCopied] = useState(false)
    const [stats, setStats] = useState<MarketingStat[]>(initialStats)

    useEffect(() => {
        setStats(initialStats)
    }, [initialStats])

    // Tracking Link Generator State
    const [genEventId, setGenEventId] = useState('')
    const [genSource, setGenSource] = useState('affiliate')
    const [genMedium, setGenMedium] = useState('referral')
    const [genCampaign, setGenCampaign] = useState('')
    const [genAffiliateCode, setGenAffiliateCode] = useState('')
    const [linkMode, setLinkMode] = useState<'standard' | 'simple'>('simple')
    const [eventPromos, setEventPromos] = useState<{ id: string, code: string }[]>([])

    // Code Validation State
    const [isCodeValid, setIsCodeValid] = useState<boolean | null>(null)
    const [isValidating, setIsValidating] = useState(false)
    const [section, setSection] = useState<'performance' | 'links' | 'messages'>('performance')
    const [smsMessage, setSmsMessage] = useState('')
    const [isSendingSms, setIsSendingSms] = useState(false)

    // Fetch promos for the selected event
    useEffect(() => {
        if (!genEventId) {
            setEventPromos([])
            return
        }

        const fetchPromos = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .schema('gatepass')
                .from('discounts')
                .select('id, code')
                .eq('event_id', genEventId)
                .order('code', { ascending: true })

            if (data) setEventPromos(data)
        }

        fetchPromos()
    }, [genEventId])

    // Code Validation State (kept for safety, but dropdown makes value valid by default)
    useEffect(() => {
        if (!genAffiliateCode || !genEventId) {
            setIsCodeValid(null)
            return
        }

        const checkCode = async () => {
            setIsValidating(true)
            const supabase = createClient()
            const { data, error } = await supabase
                .schema('gatepass')
                .from('discounts')
                .select('id')
                .eq('event_id', genEventId)
                .eq('code', genAffiliateCode.toUpperCase())
                .maybeSingle()

            setIsValidating(false)
            setIsCodeValid(!!data && !error)
        }

        const timer = setTimeout(checkCode, 500)
        return () => clearTimeout(timer)
    }, [genAffiliateCode, genEventId])

    // Derived Data
    const filteredStats = useMemo(() => {
        return stats.filter(stat => {
            const matchesSearch = stat.utm_source.toLowerCase().includes(search.toLowerCase()) ||
                stat.events.title.toLowerCase().includes(search.toLowerCase()) ||
                (stat.utm_campaign?.toLowerCase()?.includes(search.toLowerCase()) ?? false)

            const matchesEvent = selectedEventId === 'all' || stat.event_id === selectedEventId

            return matchesSearch && matchesEvent
        })
    }, [stats, search, selectedEventId])

    const aggregates = useMemo(() => {
        const views = filteredStats.reduce((acc, curr) => acc + curr.views, 0)
        const checkouts = filteredStats.reduce((acc, curr) => acc + (curr.checkouts || 0), 0)
        const transactions = filteredStats.reduce((acc, curr) => acc + curr.transactions, 0)
        const revenue = filteredStats.reduce((acc, curr) => acc + curr.revenue, 0)
        const convRate = views > 0 ? (transactions / views) * 100 : 0

        return { views, checkouts, transactions, revenue, convRate }
    }, [filteredStats])

    const funnelData = useMemo(() => {
        return [
            { step: 'Tracked views', count: aggregates.views, percentage: 100 },
            { step: 'Checkout starts', count: aggregates.checkouts, percentage: aggregates.views > 0 ? Math.round((aggregates.checkouts / aggregates.views) * 100) : null },
            { step: 'Attributed orders', count: aggregates.transactions, percentage: aggregates.checkouts > 0 ? Math.round((aggregates.transactions / aggregates.checkouts) * 100) : null }
        ]
    }, [aggregates])

    const chartData = useMemo(() => {
        const sourceMap: Record<string, { name: string, views: number, revenue: number }> = {}

        filteredStats.forEach(stat => {
            if (!sourceMap[stat.utm_source]) {
                sourceMap[stat.utm_source] = { name: stat.utm_source, views: 0, revenue: 0 }
            }
            sourceMap[stat.utm_source].views += stat.views
            sourceMap[stat.utm_source].revenue += stat.revenue
        })

        const sorted = Object.values(sourceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        return sorted
    }, [filteredStats])

    const generatedLink = useMemo(() => {
        const event = events.find(e => e.id === genEventId)
        if (!event) return ''

        const baseUrl = `${window.location.origin}/events/${event.slug}`
        const params = new URLSearchParams()

        if (linkMode === 'simple' && genAffiliateCode) {
            if (genSource) params.set('utm_source', genSource)
            params.set('code', genAffiliateCode.toUpperCase())
        } else {
            if (genSource) params.set('utm_source', genSource)
            if (genMedium) params.set('utm_medium', genMedium)
            if (genCampaign) params.set('utm_campaign', genCampaign)
            if (genAffiliateCode) params.set('code', genAffiliateCode.toUpperCase())
        }

        return `${baseUrl}?${params.toString()}`
    }, [genEventId, genSource, genMedium, genCampaign, genAffiliateCode, linkMode, events])

    const handleCopy = () => {
        if (!generatedLink) return
        navigator.clipboard.writeText(generatedLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDeleteStat = async (id: string) => {
        if (!confirm('Are you sure you want to delete this marketing record?')) return

        const supabase = createClient()
        const { error } = await supabase
            .schema('gatepass')
            .from('marketing_stats')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error('Failed to delete marketing record')
            return
        }

        toast.success('Record deleted')
        setStats(prev => prev.filter(s => s.id !== id))
    }
    
    const handleSendSMS = async () => {
        if (!selectedEventId || selectedEventId === 'all') {
            toast.error('Please select a specific event first')
            return
        }
        if (!smsMessage.trim()) {
            toast.error('Message cannot be empty')
            return
        }

        if (!organizationId) {
            toast.error('Organization context not found')
            return
        }

        setIsSendingSms(true)
        try {
            const result = await sendSMSBlast(selectedEventId, smsMessage, organizationId)
            if (result.success) {
                toast.success(result.message)
                setSmsMessage('')
            } else {
                toast.error(result.message)
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to send SMS')
        } finally {
            setIsSendingSms(false)
        }
    }

    const inputCls = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/60'
    const labelCls = 'text-sm font-medium text-gray-950 dark:text-white'
    const selectedEventTitle = events.find(e => e.id === selectedEventId)?.title

    return (
        <div className="space-y-10">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                    <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[44px]">Marketing</h1>
                    <p className="mt-3 max-w-xl text-[15px] text-gray-500 dark:text-gray-400">See which links sell, create new ones, and message your guests.</p>
                </div>
                <div className="self-start sm:self-auto">
                    <label htmlFor="marketing-event-scope" className="sr-only">Event</label>
                    <select
                        id="marketing-event-scope"
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="h-10 min-w-[220px] rounded-full border border-gray-200 bg-white px-4 text-sm text-gray-950 outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white"
                    >
                        <option value="all">All events</option>
                        {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                </div>
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 md:grid-cols-5">
                {[
                    { label: 'Link views', value: formatCompactNumber(aggregates.views) },
                    { label: 'Checkouts', value: formatCompactNumber(aggregates.checkouts) },
                    { label: 'Orders', value: formatCompactNumber(aggregates.transactions) },
                    { label: 'Revenue', value: formatCompactCurrency(aggregates.revenue, 'GHS') },
                    { label: 'Conversion', value: `${aggregates.convRate.toFixed(1)}%` },
                ].map(stat => (
                    <div key={stat.label} className="bg-white p-5 dark:bg-[#0b0b0b] sm:p-6">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</dt>
                        <dd className="mt-3 truncate text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-gray-950 dark:text-white sm:text-[30px]">{stat.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="space-y-6">
                <div role="tablist" aria-label="Marketing sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 pb-3 dark:border-white/10 lg:mx-0 lg:px-0">
                    {([['performance', 'Performance'], ['links', 'Tracking links'], ['messages', 'Messages']] as const).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={section === id}
                            onClick={() => setSection(id)}
                            className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors ${section === id
                                ? 'bg-gray-950 text-white dark:bg-white dark:text-black'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {section === 'performance' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7 lg:col-span-8">
                                <h2 className="text-base font-semibold text-gray-950 dark:text-white">Revenue by source</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sales attributed to each link or promo code.</p>
                                <div className="mt-6 h-[260px] w-full text-gray-950 dark:text-white sm:h-[300px]">
                                    {chartData.length === 0 ? (
                                        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                                            No attributed sales yet. Share a tracking link to start measuring.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#8888881a" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={12} />
                                                <YAxis hide />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 12 }}
                                                    content={({ active, payload }) => {
                                                        if (!active || !payload?.length) return null
                                                        const data = payload[0].payload
                                                        return (
                                                            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-md dark:border-white/10 dark:bg-[#1a1a1a]">
                                                                <p className="mb-1 text-xs text-gray-500">{data.name}</p>
                                                                <p className="text-base font-semibold dark:text-white">GHS {data.revenue.toLocaleString()}</p>
                                                                <p className="mt-1 text-xs text-gray-500">{data.views.toLocaleString()} views</p>
                                                            </div>
                                                        )
                                                    }}
                                                />
                                                <Bar dataKey="revenue" fill="currentColor" radius={[8, 8, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7 lg:col-span-4">
                                <h2 className="text-base font-semibold text-gray-950 dark:text-white">From view to order</h2>
                                <ol className="mt-6 space-y-6">
                                    {funnelData.map((item, idx) => (
                                        <li key={item.step}>
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.step}</p>
                                                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-950 dark:text-white">{item.count.toLocaleString()}</p>
                                                </div>
                                                {idx > 0 && <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">{item.percentage === null ? '—' : `${item.percentage}%`}</span>}
                                            </div>
                                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                                                <div className="h-full rounded-full bg-gray-950 transition-[width] duration-700 dark:bg-white" style={{ width: `${idx === 0 ? 100 : item.percentage ?? 0}%` }} />
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        </div>

                        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-950 dark:text-white">Sources</h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Views and sales for each link and promo code.</p>
                                </div>
                                <div className="relative w-full sm:max-w-[280px]">
                                    <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                                    <input placeholder="Search sources" aria-label="Search marketing sources" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/50" />
                                </div>
                            </div>
                            {filteredStats.length === 0 ? (
                                <p className="border-t border-gray-100 px-7 py-14 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                                    {stats.length === 0 ? 'No tracked sources yet. Create a link in Tracking links.' : 'No sources match this search.'}
                                </p>
                            ) : (
                                <div className="overflow-x-auto border-t border-gray-100 dark:border-white/10">
                                    <table className="w-full min-w-[640px] text-sm">
                                        <thead className="text-xs text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-7 py-3 text-left font-medium">Source</th>
                                                <th className="px-4 py-3 text-right font-medium">Views</th>
                                                <th className="px-4 py-3 text-right font-medium">Orders</th>
                                                <th className="px-4 py-3 text-right font-medium">Revenue</th>
                                                <th className="px-4 py-3 text-right font-medium">Conversion</th>
                                                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                                            {filteredStats.map((stat) => (
                                                <tr key={stat.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                                                    <td className="px-7 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-950 dark:text-white">{stat.utm_source}</span>
                                                            {stat.utm_campaign && <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">{stat.utm_campaign}</span>}
                                                        </div>
                                                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-gray-500 dark:text-gray-400">{stat.events.title}</p>
                                                    </td>
                                                    <td className="px-4 py-4 text-right tabular-nums text-gray-950 dark:text-white">{stat.views.toLocaleString()}</td>
                                                    <td className="px-4 py-4 text-right tabular-nums text-gray-950 dark:text-white">{stat.transactions.toLocaleString()}</td>
                                                    <td className="px-4 py-4 text-right font-semibold tabular-nums text-gray-950 dark:text-white">GHS {stat.revenue.toLocaleString()}</td>
                                                    <td className="px-4 py-4 text-right tabular-nums text-gray-950 dark:text-white">{stat.views > 0 ? `${((stat.transactions / stat.views) * 100).toFixed(1)}%` : '—'}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button onClick={() => handleDeleteStat(stat.id)} aria-label={`Delete ${stat.utm_source}`} className="flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {section === 'links' && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <section className="space-y-6 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-950 dark:text-white">Create a tracking link</h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Share it anywhere. Views and sales show up under Performance.</p>
                                </div>
                                <div className="flex shrink-0 rounded-full border border-gray-200 p-0.5 dark:border-white/10" role="group" aria-label="Link options">
                                    {([['simple', 'Simple'], ['standard', 'Advanced']] as const).map(([mode, label]) => (
                                        <button key={mode} type="button" onClick={() => setLinkMode(mode)} aria-pressed={linkMode === mode} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${linkMode === mode ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 dark:text-gray-400'}`}>{label}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="marketing-link-event" className={labelCls}>Event</label>
                                <select id="marketing-link-event" value={genEventId} onChange={(e) => setGenEventId(e.target.value)} className={inputCls}>
                                    <option value="" disabled>Choose an event</option>
                                    {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                                </select>
                            </div>

                            <div className={linkMode === 'standard' ? 'grid gap-5 sm:grid-cols-2' : 'space-y-5'}>
                                <div className="space-y-2">
                                    <label htmlFor="marketing-link-source" className={labelCls}>{linkMode === 'simple' ? 'Name this link' : 'Source'}</label>
                                    <input id="marketing-link-source" value={genSource} onChange={(e) => setGenSource(e.target.value)} placeholder={linkMode === 'simple' ? 'e.g. instagram-bio' : 'instagram'} className={inputCls} />
                                </div>
                                {linkMode === 'standard' && (
                                    <div className="space-y-2">
                                        <label htmlFor="marketing-link-medium" className={labelCls}>Medium</label>
                                        <input id="marketing-link-medium" value={genMedium} onChange={(e) => setGenMedium(e.target.value)} placeholder="ad" className={inputCls} />
                                    </div>
                                )}
                            </div>
                            {linkMode === 'standard' && (
                                <div className="space-y-2">
                                    <label htmlFor="marketing-link-campaign" className="flex items-baseline justify-between text-sm font-medium text-gray-950 dark:text-white">Campaign <span className="text-xs font-normal text-gray-400">Optional</span></label>
                                    <input id="marketing-link-campaign" value={genCampaign} onChange={(e) => setGenCampaign(e.target.value)} placeholder="launch" className={inputCls} />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="marketing-link-promo" className="flex items-baseline justify-between text-sm font-medium text-gray-950 dark:text-white">
                                    Promo code
                                    {genAffiliateCode && (
                                        <span className="text-xs font-normal">
                                            {isValidating ? <span className="text-gray-400">Checking…</span> : isCodeValid ? <span className="text-emerald-600 dark:text-emerald-400">Active</span> : <span className="text-red-600 dark:text-red-400">Not found</span>}
                                        </span>
                                    )}
                                </label>
                                <select id="marketing-link-promo" value={genAffiliateCode} onChange={(e) => setGenAffiliateCode(e.target.value)} className={inputCls}>
                                    <option value="">None</option>
                                    {eventPromos.map(p => <option key={p.id} value={p.code}>{p.code}</option>)}
                                </select>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Applied automatically when someone opens the link.</p>
                            </div>
                        </section>

                        <section className="flex flex-col rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
                            <h2 className="text-base font-semibold text-gray-950 dark:text-white">Your link</h2>
                            {generatedLink ? (
                                <div className="mt-6 flex flex-1 flex-col gap-6">
                                    <div className="flex justify-center rounded-2xl bg-gray-50 p-6 dark:bg-white/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedLink)}&bgcolor=ffffff&color=000000`} alt="QR code for this link" className="size-40 rounded-xl bg-white p-2" />
                                    </div>
                                    <p className="break-all rounded-2xl border border-gray-200 px-4 py-3 font-mono text-xs leading-relaxed text-gray-950 dark:border-white/10 dark:text-white">{generatedLink}</p>
                                    <div className="mt-auto flex gap-2">
                                        <button onClick={handleCopy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gray-950 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black">
                                            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                                            {copied ? 'Copied' : 'Copy link'}
                                        </button>
                                        <a
                                            href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(generatedLink)}`}
                                            download={`qr_${genSource}.png`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-200 px-5 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                                        >
                                            <Download className="size-4" aria-hidden="true" /> QR code
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                                    Choose an event to create a link.
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {section === 'messages' && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <section className="space-y-5 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7 lg:col-span-8">
                            <div>
                                <h2 className="text-base font-semibold text-gray-950 dark:text-white">Text your guests</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {selectedEventId === 'all'
                                        ? 'Choose an event at the top of the page to message its guests.'
                                        : <>Sends to confirmed guests of <span className="font-medium text-gray-950 dark:text-white">{selectedEventTitle}</span> who gave a phone number.</>}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="marketing-sms-message" className={labelCls}>Message</label>
                                <textarea
                                    id="marketing-sms-message"
                                    value={smsMessage}
                                    onChange={(e) => setSmsMessage(e.target.value)}
                                    placeholder="Doors open at 6pm tonight. Bring your ticket and see you there!"
                                    rows={5}
                                    className="w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/60"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {smsMessage.length} characters · {Math.max(1, Math.ceil(smsMessage.length / 160))} SMS per guest
                                </p>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSendSMS}
                                    disabled={isSendingSms || !smsMessage.trim() || selectedEventId === 'all'}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gray-950 px-6 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
                                >
                                    {isSendingSms ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" aria-hidden="true" /> Send message</>}
                                </button>
                            </div>
                        </section>

                        <aside className="rounded-3xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-600 dark:bg-white/5 dark:text-gray-300 sm:p-7 lg:col-span-4">
                            <p className="font-medium text-gray-950 dark:text-white">Before you send</p>
                            <ul className="mt-3 space-y-2">
                                <li>Messages go through your own SMS account. Connect one in <a href="/dashboard/settings?tab=messaging" className="font-medium text-gray-950 underline underline-offset-4 dark:text-white">Settings → Messaging</a>.</li>
                                <li>Only confirmed guests with a phone number receive it.</li>
                                <li>Every 160 characters is one SMS, billed by your provider.</li>
                                <li>Large sends can take a few minutes. Keep this tab open until it finishes.</li>
                            </ul>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    )
}
