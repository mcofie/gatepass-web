'use client'

import React, { useState, useMemo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
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
} from 'lucide-react'

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
}

export function MarketingDashboard({ initialStats, events }: MarketingDashboardProps) {
    const [search, setSearch] = useState('')
    const [selectedEventId, setSelectedEventId] = useState<string>('all')
    const [copied, setCopied] = useState(false)

    // UTM Link Generator State
    const [genEventId, setGenEventId] = useState('')
    const [genSource, setGenSource] = useState('instagram')
    const [genMedium, setGenMedium] = useState('ad')
    const [genCampaign, setGenCampaign] = useState('')

    // Derived Data
    const filteredStats = useMemo(() => {
        return initialStats.filter(stat => {
            const matchesSearch = stat.utm_source.toLowerCase().includes(search.toLowerCase()) ||
                stat.events.title.toLowerCase().includes(search.toLowerCase()) ||
                (stat.utm_campaign?.toLowerCase().includes(search.toLowerCase()))

            const matchesEvent = selectedEventId === 'all' || stat.event_id === selectedEventId

            return matchesSearch && matchesEvent
        })
    }, [initialStats, search, selectedEventId])

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
            { step: 'Ad Views', count: aggregates.views, percentage: 100, color: 'bg-blue-500' },
            { step: 'Checkout Intent', count: aggregates.checkouts, percentage: aggregates.views > 0 ? Math.round((aggregates.checkouts / aggregates.views) * 100) : 0, color: 'bg-amber-500' },
            { step: 'Final Sales', count: aggregates.transactions, percentage: aggregates.checkouts > 0 ? Math.round((aggregates.transactions / aggregates.checkouts) * 100) : 0, color: 'bg-emerald-500' }
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

        return Object.values(sourceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    }, [filteredStats])

    const generatedLink = useMemo(() => {
        const event = events.find(e => e.id === genEventId)
        if (!event) return ''

        const baseUrl = `${window.location.origin}/events/${event.slug}`
        const params = new URLSearchParams()
        if (genSource) params.set('utm_source', genSource)
        if (genMedium) params.set('utm_medium', genMedium)
        if (genCampaign) params.set('utm_campaign', genCampaign)

        return `${baseUrl}?${params.toString()}`
    }, [genEventId, genSource, genMedium, genCampaign, events])

    const handleCopy = () => {
        if (!generatedLink) return
        navigator.clipboard.writeText(generatedLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <div className="flex justify-end">

                <div className="flex items-center gap-3 bg-white dark:bg-[#111] p-1.5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm">
                    <div className="pl-3 hidden sm:block">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Scope</span>
                    </div>
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="bg-gray-50 dark:bg-black border-none rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-all min-w-[200px]"
                    >
                        <option value="all">Global Attribution</option>
                        {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                </div>
            </div>

            {/* Performance Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <StatCard
                    label="Reach"
                    value={aggregates.views.toLocaleString()}
                    icon={Users}
                    trend="+12%"
                    description="Unique Impressions"
                    color="blue"
                />
                <StatCard
                    label="Intent"
                    value={aggregates.checkouts.toLocaleString()}
                    icon={Target}
                    trend="+8%"
                    description="Checkout Starts"
                    color="amber"
                />
                <StatCard
                    label="Sales"
                    value={aggregates.transactions.toLocaleString()}
                    icon={ShoppingCart}
                    trend="+3%"
                    description="Completed Orders"
                    color="green"
                />
                <StatCard
                    label="Revenue"
                    value={`GHS ${aggregates.revenue.toLocaleString()}`}
                    icon={DollarSign}
                    trend="+14%"
                    description="Campaign Gross"
                    color="blue"
                />
                <StatCard
                    label="Yield"
                    value={`${aggregates.convRate.toFixed(2)}%`}
                    icon={TrendingUp}
                    trend="+1%"
                    description="Views to Sales"
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Performance Chart */}
                <div className="lg:col-span-8 bg-white dark:bg-[#111] rounded-3xl p-8 border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-xl font-bold dark:text-white tracking-tight">Revenue by Source</h3>
                            <p className="text-xs text-gray-400 font-medium">Attributed revenue across marketing channels</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-full uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            Live Feed
                        </div>
                    </div>

                    <div className="h-[350px] w-full mt-4">
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
                                                <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{data.name}</p>
                                                    <p className="text-lg font-black dark:text-white">GHS {data.revenue.toLocaleString()}</p>
                                                    <p className="text-[10px] font-medium text-blue-500 mt-1">{data.views.toLocaleString()} Impressions</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="revenue" radius={[12, 12, 12, 12]} barSize={40}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={1} fill={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conversion Funnel */}
                <div className="lg:col-span-4 bg-white dark:bg-[#111] rounded-3xl p-8 border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.02)] flex flex-col">
                    <div className="mb-8">
                        <h3 className="text-xl font-bold dark:text-white tracking-tight">Channel Efficiency</h3>
                        <p className="text-xs text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Conversion journey breakdown</p>
                    </div>

                    <div className="space-y-8 flex-1 flex flex-col justify-center">
                        {funnelData.map((item, idx) => (
                            <div key={item.step} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none">{item.step}</span>
                                        <div className="text-xl font-black dark:text-white leading-none">{item.count.toLocaleString()}</div>
                                    </div>
                                    {idx > 0 && (
                                        <div className="flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{item.percentage}%</span>
                                        </div>
                                    )}
                                </div>
                                <div className="h-1.5 bg-gray-50 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`}
                                        style={{ width: `${idx === 0 ? 100 : item.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-50 dark:border-white/5">
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
                            <p className="text-[11px] font-medium text-gray-400 text-center leading-relaxed">
                                <span className="font-bold text-gray-700 dark:text-white">Pro Tip:</span> A drop of {'>'}40% between Intent and Sales points to payment friction.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Source Details & Campaign Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Channel Detail Table */}
                <div className="lg:col-span-8 bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-gray-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-bold dark:text-white tracking-tight">Channel Detail</h3>
                            <p className="text-xs text-gray-400 font-medium">In-depth source attribution logs</p>
                        </div>
                        <div className="relative w-full sm:max-w-[280px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                placeholder="Filter sources..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-transparent rounded-xl text-xs font-bold ring-blue-500/20 focus:ring-4 focus:bg-white dark:focus:bg-black transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-50 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Source Entity</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Reach</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Sales</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Revenue</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Yield</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {filteredStats.map((stat) => (
                                    <tr key={stat.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm uppercase dark:text-white">{stat.utm_source}</span>
                                                    {stat.utm_campaign && (
                                                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                            {stat.utm_campaign}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-medium text-gray-400 truncate max-w-[200px]">{stat.events.title}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right font-bold text-sm dark:text-white">{stat.views.toLocaleString()}</td>
                                        <td className="px-8 py-6 text-right font-bold text-sm dark:text-white">{stat.transactions.toLocaleString()}</td>
                                        <td className="px-8 py-6 text-right">
                                            <p className="font-bold text-sm dark:text-white text-green-500">GHS {stat.revenue.toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                                                {stat.views > 0 ? ((stat.transactions / stat.views) * 100).toFixed(1) : 0}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center text-gray-400 text-sm font-medium">No results matching your filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tracking Link Generator */}
                <div className="lg:col-span-4 bg-black dark:bg-[#111] rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl border dark:border-white/10 h-full">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] -mr-32 -mt-32" />

                    <div className="relative z-10 space-y-8 h-full flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                                <Share2 className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight">Campaign Builder</h3>
                            <p className="text-xs text-white/40 font-medium mt-1">Generate trackable UTM links</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Destination Event</label>
                                <select
                                    value={genEventId}
                                    onChange={(e) => setGenEventId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white/10 transition-all appearance-none text-white"
                                >
                                    <option value="" disabled className="text-black">Select an event...</option>
                                    {events.map(e => <option key={e.id} value={e.id} className="text-black">{e.title}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Source</label>
                                    <input
                                        value={genSource}
                                        onChange={(e) => setGenSource(e.target.value)}
                                        placeholder="instagram"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white/10 transition-all text-white placeholder:text-white/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Medium</label>
                                    <input
                                        value={genMedium}
                                        onChange={(e) => setGenMedium(e.target.value)}
                                        placeholder="story"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white/10 transition-all text-white placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Campaign</label>
                                <input
                                    value={genCampaign}
                                    onChange={(e) => setGenCampaign(e.target.value)}
                                    placeholder="summer_2024"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white/10 transition-all text-white placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        <div className="pt-6">
                            {generatedLink ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 group cursor-pointer" onClick={handleCopy}>
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Snippet</p>
                                        <p className="text-[10px] font-mono break-all text-blue-400 font-bold line-clamp-2">{generatedLink}</p>
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy Link'}
                                    </button>
                                </div>
                            ) : (
                                <div className="p-6 border border-dashed border-white/10 rounded-2xl text-center">
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] leading-relaxed">
                                        Fill details to generate<br />tracking link
                                    </p>
                                </div>
                            )}
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
    trend: string
    description: string
    color: 'blue' | 'green' | 'amber' | 'purple'
}

function StatCard({ label, value, icon: Icon, trend, description, color }: StatCardProps) {
    const colorClasses: Record<string, string> = {
        blue: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
        green: 'text-green-600 bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20',
        amber: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20',
        purple: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20',
    }

    return (
        <div className="bg-white dark:bg-[#111] rounded-3xl p-6 border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between h-full min-h-[140px]">
            <div className="flex items-start justify-between">
                <div className={`p-3 rounded-2xl border ${colorClasses[color]} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">{label}</span>
                    <div className="flex items-center gap-1 py-0.5 px-2 bg-green-500/5 dark:bg-green-500/10 rounded-full border border-green-500/10">
                        <TrendingUp className="w-2.5 h-2.5 text-green-500" />
                        <span className="text-[10px] font-black text-green-600 dark:text-green-400">{trend}</span>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <h4 className="text-2xl font-black dark:text-white tracking-tight leading-none mb-1">{value}</h4>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{description}</p>
            </div>
        </div>
    )
}
