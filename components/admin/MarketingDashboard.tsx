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
    Share2,
    Copy,
    Check,
    TrendingUp,
    Users,
    ShoppingCart,
    DollarSign,
    Target,
    Search,
    Download,
    Trash2,
    MessageSquare,
    Send,
    AlertCircle,
    Loader2
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Performance</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Attributed activity from your shared links</p>
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="marketing-event-scope" className="text-xs font-medium text-gray-500 dark:text-gray-400">Event</label>
                    <select
                        id="marketing-event-scope"
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="h-10 min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white"
                    >
                        <option value="all">All events</option>
                        {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                </div>
            </div>

            {/* Performance Snapshot */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <StatCard
                    label="Views"
                    value={formatCompactNumber(aggregates.views)}
                    icon={Users}
                    description="Tracked link opens"
                />
                <StatCard
                    label="Checkouts"
                    value={formatCompactNumber(aggregates.checkouts)}
                    icon={Target}
                    description="Checkout starts"
                />
                <StatCard
                    label="Sales"
                    value={formatCompactNumber(aggregates.transactions)}
                    icon={ShoppingCart}
                    description="Completed orders"
                />
                <StatCard
                    label="Revenue"
                    value={formatCompactCurrency(aggregates.revenue, 'GHS')}
                    icon={DollarSign}
                    description="Attributed gross"
                />
                <StatCard
                    label="Conversion"
                    value={`${aggregates.convRate.toFixed(2)}%`}
                    icon={TrendingUp}
                    description="Views to sales"
                />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Main Performance Chart */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6 lg:col-span-8">
                    <div className="mb-7 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Revenue by source</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Attributed revenue across marketing channels</p>
                        </div>
                    </div>

                    <div className="mt-4 h-[260px] w-full text-gray-900 dark:text-white sm:h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#8888881a" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                    dy={15}
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 12 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-white/10 dark:bg-[#1a1a1a]">
                                                    <p className="mb-1 text-xs text-gray-500">{data.name}</p>
                                                    <p className="text-base font-semibold dark:text-white">GHS {data.revenue.toLocaleString()}</p>
                                                    <p className="mt-1 text-xs text-gray-500">{data.views.toLocaleString()} views</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="revenue" fill="currentColor" radius={[8, 8, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conversion Funnel */}
                <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6 lg:col-span-4">
                    <div className="mb-8">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Conversion journey</h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">From views to completed orders</p>
                    </div>

                    <div className="space-y-8 flex-1 flex flex-col justify-center">
                        {funnelData.map((item, idx) => (
                            <div key={item.step} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.step}</span>
                                        <div className="text-xl font-semibold dark:text-white">{item.count.toLocaleString()}</div>
                                    </div>
                                    {idx > 0 && (
                                        <div className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 dark:bg-white/10">
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.percentage === null ? '—' : `${item.percentage}%`}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="h-1.5 bg-gray-50 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gray-900 transition-[width] duration-700 ease-out dark:bg-white"
                                        style={{ width: `${idx === 0 ? 100 : item.percentage ?? 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            {/* Source Details & Campaign Builder */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
                {/* Channel Detail Table */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111] lg:col-span-8">
                    <div className="flex flex-col gap-4 border-b border-gray-100 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sources</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Traffic and sales by campaign source</p>
                        </div>
                        <div className="relative w-full sm:max-w-[280px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                placeholder="Search sources"
                                aria-label="Search marketing sources"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:focus:border-white/40"
                            />
                        </div>
                    </div>

                    <div className="min-h-[280px] overflow-x-auto">
                        <table className="w-full min-w-[670px]">
                            <thead>
                                <tr className="border-b border-gray-50 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500">Source</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500">Views</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500">Orders</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500">Revenue</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500">Rate</th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {filteredStats.map((stat) => (
                                    <tr key={stat.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{stat.utm_source}</span>
                                                    {stat.utm_campaign && (
                                                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                                            {stat.utm_campaign}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-medium text-gray-400 truncate max-w-[200px]">{stat.events.title}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-sm dark:text-white">{stat.views.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-medium text-sm dark:text-white">{stat.transactions.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">GHS {stat.revenue.toLocaleString()}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {stat.views > 0 ? `${((stat.transactions / stat.views) * 100).toFixed(1)}%` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteStat(stat.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Delete Record"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStats.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-16 text-center text-sm text-gray-500 dark:text-gray-400">No sources match this search.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tracking Link Generator */}
                <div className="h-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 dark:border-white/10 dark:bg-[#111] dark:text-white sm:p-6 lg:col-span-4">

                    <div className="flex h-full flex-col justify-between space-y-7">
                        <div>
                            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/10">
                                <Share2 className="h-4 w-4 text-gray-700 dark:text-white" />
                            </div>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-base font-semibold">Tracking links</h3>
                                <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
                                    <button
                                        onClick={() => setLinkMode('simple')}
                                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${linkMode === 'simple' ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >Simple</button>
                                    <button
                                        onClick={() => setLinkMode('standard')}
                                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${linkMode === 'standard' ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                    >Advanced</button>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Create shareable links to measure traffic.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="marketing-link-event" className="text-sm font-medium text-gray-700 dark:text-gray-300">Destination event</label>
                                <select
                                    id="marketing-link-event"
                                    value={genEventId}
                                    onChange={(e) => setGenEventId(e.target.value)}
                                    className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors appearance-none text-gray-900 dark:text-white"
                                >
                                    <option value="" disabled className="text-black">Select an event...</option>
                                    {events.map(e => <option key={e.id} value={e.id} className="text-black">{e.title}</option>)}
                                </select>
                            </div>

                            {linkMode === 'simple' ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label htmlFor="marketing-link-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Source name</label>
                                        <input
                                            id="marketing-link-name"
                                            value={genSource}
                                            onChange={(e) => setGenSource(e.target.value)}
                                            placeholder="affiliate"
                                            className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between ml-1">
                                            <label htmlFor="marketing-link-promo" className="text-sm font-medium text-gray-700 dark:text-gray-300">Promo code</label>
                                            {genAffiliateCode && (
                                                <div className="flex items-center gap-1.5 translate-y-[-2px]">
                                                    {isValidating ? (
                                                        <div className="w-2.5 h-2.5 border border-white/20 border-t-white rounded-full animate-spin" />
                                                    ) : isCodeValid ? (
                                                        <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                                                            <Check className="w-2.5 h-2.5" />
                                                            Verified
                                                        </div>
                                                    ) : (
                                                        <div className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">
                                                            Code Missing
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <select
                                            id="marketing-link-promo"
                                            value={genAffiliateCode}
                                            onChange={(e) => setGenAffiliateCode(e.target.value)}
                                            className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors text-gray-900 dark:text-white appearance-none"
                                        >
                                            <option value="" className="text-black">No Promo Code</option>
                                            {eventPromos.map(p => (
                                                <option key={p.id} value={p.code} className="text-black">
                                                    {p.code}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Links directly to the discount code for auto-apply.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* Source Selection */}
                                        <div className="space-y-3">
                                            <label htmlFor="marketing-link-source" className="text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
                                            <input
                                                id="marketing-link-source"
                                                value={genSource}
                                                onChange={(e) => setGenSource(e.target.value)}
                                                placeholder="instagram"
                                                className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500"
                                            />
                                        </div>

                                        {/* Medium Selection */}
                                        <div className="space-y-3">
                                            <label htmlFor="marketing-link-medium" className="text-sm font-medium text-gray-700 dark:text-gray-300">Medium</label>
                                            <input
                                                id="marketing-link-medium"
                                                value={genMedium}
                                                onChange={(e) => setGenMedium(e.target.value)}
                                                placeholder="ad"
                                                className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="marketing-link-campaign" className="text-sm font-medium text-gray-700 dark:text-gray-300">Campaign (optional)</label>
                                        <input
                                            id="marketing-link-campaign"
                                            value={genCampaign}
                                            onChange={(e) => setGenCampaign(e.target.value)}
                                            placeholder="launch_campaign"
                                            className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500"
                                        />
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <label htmlFor="marketing-link-advanced-promo" className="text-sm font-medium text-gray-700 dark:text-gray-300">Promo code</label>
                                        <select
                                            id="marketing-link-advanced-promo"
                                            value={genAffiliateCode}
                                            onChange={(e) => setGenAffiliateCode(e.target.value)}
                                            className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-gray-500 transition-colors text-gray-900 dark:text-white appearance-none"
                                        >
                                            <option value="" className="text-black">None</option>
                                            {eventPromos.map(p => (
                                                <option key={p.id} value={p.code} className="text-black">
                                                    {p.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="pt-6">
                            {generatedLink ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 group">
                                        <div className="w-20 h-20 bg-white p-1 rounded-lg flex-shrink-0">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generatedLink)}&bgcolor=ffffff&color=000000`}
                                                alt="Campaign QR"
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="mb-1.5 text-xs font-medium text-gray-500">Generated link</p>
                                            <div className="p-2.5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                                                <p className="text-[10px] font-mono break-all text-gray-900 dark:text-white font-medium line-clamp-2 leading-relaxed">{generatedLink}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleCopy}
                                            className="flex-1 bg-black hover:opacity-80 dark:bg-white text-white dark:text-black font-semibold py-3 rounded-lg transition-opacity text-sm flex items-center justify-center gap-2"
                                        >
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            {copied ? 'Link Copied' : 'Copy Link'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(generatedLink)}`;
                                                link.download = `qr_${genSource}_${genCampaign}.png`;
                                                link.target = '_blank';
                                                link.click();
                                            }}
                                            className="w-12 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg flex items-center justify-center transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                                            title="Download QR Code"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Select an event to create a link
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* SMS Blast Tool */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6 lg:col-span-12">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">
                            <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Message attendees</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Send an SMS to confirmed guests of the selected event.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="marketing-sms-message" className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                                <textarea
                                    id="marketing-sms-message"
                                    value={smsMessage}
                                    onChange={(e) => setSmsMessage(e.target.value)}
                                    placeholder="e.g. Hello! Don't forget our event starts at 6 PM tonight. See you there!"
                                    rows={5}
                                    className="w-full resize-none rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-900 outline-none transition-colors focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/40"
                                />
                                <div className="flex justify-between items-center px-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {smsMessage.length} characters • {Math.ceil(smsMessage.length / 160)} segments
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {160 - (smsMessage.length % 160)} chars left in segment
                                    </p>
                                </div>
                            </div>
                            
                            <button
                                onClick={handleSendSMS}
                                disabled={isSendingSms || !smsMessage.trim() || selectedEventId === 'all'}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-black"
                            >
                                {isSendingSms ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send message
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-white/5">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm font-semibold">Before you send</span>
                                </div>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Must have a carrier token connected in <strong>Settings</strong>.</p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Messages are sent to <strong>confirmed</strong> guests only.</p>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Each 160 characters counts as 1 SMS segment.</p>
                                    </li>
                                </ul>
                            </div>
                            
                            <div className="pt-6 border-t border-gray-200 dark:border-white/5 mt-6">
                                <p className="text-[10px] text-gray-400 font-medium italic leading-relaxed text-center">
                                    Broadcasts can take up to 5 minutes to complete depending on carrier throughput. Avoid closing this tab during transmission.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface StatCardProps {
    label: string
    value: string
    icon: React.ElementType
    description: string
}

function StatCard({ label, value, icon: Icon, description }: StatCardProps) {
    return (
        <div className="flex min-h-[130px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </div>
            <div className="mt-4 min-w-0">
                <h4 className="truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white" title={value}>{value}</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
            </div>
        </div>
    )
}
