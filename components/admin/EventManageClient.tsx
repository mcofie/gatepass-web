'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Globe, DollarSign, Users, BarChart3, Share2, Video, ImageIcon, Ticket, Plus, Search, ScanLine, Filter, Check, Edit2, Trash2, Eye, Copy, Download } from 'lucide-react'
import { Event, TicketTier, Discount } from '@/types/gatepass'
import clsx from 'clsx'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { aggregateSalesOverTime, aggregateTicketTypes, generateCSV, downloadCSV } from '@/utils/analytics'


interface EventManageClientProps {
    event: Event
    initialTiers: TicketTier[]
}

export function EventManageClient({ event: initialEvent, initialTiers }: EventManageClientProps) {
    const [event, setEvent] = useState(initialEvent)
    const [activeTab, setActiveTab] = useState<'details' | 'tickets' | 'attendees' | 'discounts' | 'payouts'>('tickets')
    const [loading, setLoading] = useState(false)

    // Tickets State
    const [tiers, setTiers] = useState<TicketTier[]>(initialTiers) // Kept initialTiers from props

    // Attendees State
    const [tickets, setTickets] = useState<any[]>([])
    const [loadingTickets, setLoadingTickets] = useState(false)
    const [ticketPage, setTicketPage] = useState(0)
    const [ticketCount, setTicketCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [isCheckInMode, setIsCheckInMode] = useState(false)
    const TICKETS_PER_PAGE = 20

    // Discounts State
    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [discountForm, setDiscountForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed', value: 0, max_uses: 0 })
    const [creatingDiscount, setCreatingDiscount] = useState(false)
    const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)

    // Payouts State
    const [payoutStats, setPayoutStats] = useState({ totalCollected: 0, platformFee: 0, organizerNet: 0, transactionCount: 0 })
    const [loadingPayouts, setLoadingPayouts] = useState(false)

    // Tier Form
    const [tierForm, setTierForm] = useState<{ name: string, price: number, total_quantity: number, description: string, perks: string[] }>({
        name: '', price: 0, total_quantity: 100, description: '', perks: []
    })
    const [creatingTier, setCreatingTier] = useState(false)

    // Tier Editing State
    const [editingTierId, setEditingTierId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<{ name: string, price: number, total_quantity: number, description: string, perks: string[] }>({
        name: '', price: 0, total_quantity: 0, description: '', perks: []
    })

    const [copiedId, setCopiedId] = useState<string | null>(null)

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code)
        setCopiedId(id)
        toast.success('Code copied!')
        setTimeout(() => setCopiedId(null), 2000)
    }

    const supabase = createClient()
    const router = useRouter()

    // Stats Calculation
    const stats = React.useMemo(() => {
        const totalRevenue = tiers.reduce((acc, tier) => acc + (tier.price * tier.quantity_sold), 0)
        const totalSold = tiers.reduce((acc, tier) => acc + tier.quantity_sold, 0)
        const totalCapacity = tiers.reduce((acc, tier) => acc + tier.total_quantity, 0)
        const utilization = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0
        return { totalRevenue, totalSold, totalCapacity, utilization }
    }, [tiers])

    // ---------------- DETAILS LOGIC ----------------
    const updateEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await supabase.schema('gatepass').from('events').update({
                title: event.title,
                slug: event.slug,
                description: event.description,
                starts_at: event.starts_at,
                ends_at: event.ends_at,
                venue_name: event.venue_name,
                venue_address: event.venue_address,
                latitude: event.latitude,
                longitude: event.longitude,
                social_website: event.social_website,
                social_instagram: event.social_instagram,
                social_twitter: event.social_twitter,
                social_facebook: event.social_facebook,
                poster_url: event.poster_url,
                video_url: event.video_url,
                is_published: event.is_published,
                fee_bearer: event.fee_bearer,
                platform_fee_percent: event.platform_fee_percent
            }).eq('id', event.id)

            if (error) throw error
            toast.success('Event updated successfully')
            router.refresh()
        } catch (e: any) {
            toast.error('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    // ---------------- TICKETS / TIERS LOGIC ----------------
    const fetchTiers = async () => {
        const { data } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', event.id).order('price')
        if (data) setTiers(data as TicketTier[])
    }

    const addTier = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreatingTier(true)
        try {
            const { error } = await supabase.schema('gatepass').from('ticket_tiers').insert({
                event_id: event.id,
                ...tierForm
            })
            if (error) throw error

            await fetchTiers()
            setTierForm({ name: '', price: 0, total_quantity: 100, description: '', perks: [] })
            toast.success('Ticket tier added')
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setCreatingTier(false)
        }
    }

    const deleteTier = async (id: string) => {
        if (!confirm('Are you sure?')) return
        const { error } = await supabase.schema('gatepass').from('ticket_tiers').delete().eq('id', id)
        if (error) toast.error(error.message)
        else {
            await fetchTiers()
            toast.success('Tier deleted')
        }
    }

    const startEditing = (tier: TicketTier) => {
        setEditingTierId(tier.id)
        setEditForm({
            name: tier.name,
            price: tier.price,
            total_quantity: tier.total_quantity,
            description: tier.description || '',
            perks: tier.perks || []
        })
    }

    const cancelEditing = () => {
        setEditingTierId(null)
        setEditForm({ name: '', price: 0, total_quantity: 0, description: '', perks: [] })
    }

    const saveTier = async (id: string) => {
        try {
            const { error } = await supabase.schema('gatepass').from('ticket_tiers').update({
                name: editForm.name,
                price: editForm.price,
                total_quantity: editForm.total_quantity,
                description: editForm.description,
                perks: editForm.perks
            }).eq('id', id)

            if (error) throw error

            await fetchTiers()
            cancelEditing()
            toast.success('Tier updated')
        } catch (e: any) {
            toast.error('Error updating tier: ' + e.message)
        }
    }

    // ---------------- DISCOUNTS LOGIC ----------------
    const fetchDiscounts = async () => {
        const { data } = await supabase.schema('gatepass').from('discounts').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
        if (data) {
            console.log('Fetched Discounts:', data)
            setDiscounts(data as Discount[])
        }
    }

    const handleSaveDiscount = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreatingDiscount(true)
        try {
            if (editingDiscountId) {
                const { error } = await supabase.schema('gatepass').from('discounts').update({
                    code: discountForm.code.toUpperCase(),
                    type: discountForm.type,
                    value: discountForm.value,
                    max_uses: discountForm.max_uses > 0 ? discountForm.max_uses : null,
                }).eq('id', editingDiscountId)

                if (error) throw error
                toast.success('Discount updated!')
                setEditingDiscountId(null)
            } else {
                const { error } = await supabase.schema('gatepass').from('discounts').insert({
                    event_id: event.id,
                    code: discountForm.code.toUpperCase(),
                    type: discountForm.type,
                    value: discountForm.value,
                    max_uses: discountForm.max_uses > 0 ? discountForm.max_uses : null,
                    used_count: 0
                })

                if (error) throw error
                toast.success('Discount code created!')
            }

            await fetchDiscounts()
            setDiscountForm({ code: '', type: 'percentage', value: 0, max_uses: 0 })
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setCreatingDiscount(false)
        }
    }

    const startEditingDiscount = (discount: Discount) => {
        setEditingDiscountId(discount.id)
        setDiscountForm({
            code: discount.code,
            type: discount.type,
            value: discount.value,
            max_uses: discount.max_uses || 0
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEditingDiscount = () => {
        setEditingDiscountId(null)
        setDiscountForm({ code: '', type: 'percentage', value: 0, max_uses: 0 })
    }

    const deleteDiscount = async (id: string) => {
        if (!confirm('Are you sure you want to delete this discount code?')) return
        const { error } = await supabase.schema('gatepass').from('discounts').delete().eq('id', id)
        if (error) toast.error(error.message)
        else {
            await fetchDiscounts()
            toast.success('Discount deleted')
        }
    }

    // ---------------- ATTENDEES LOGIC ----------------
    const fetchTickets = async (page = 0) => {
        setLoadingTickets(true)
        const from = page * TICKETS_PER_PAGE
        const to = from + TICKETS_PER_PAGE - 1

        let query = supabase
            .schema('gatepass')
            .from('tickets')
            .select(`
                id, status, order_reference, created_at,
                ticket_tiers ( name ),
                profiles!inner ( full_name, id )
            `, { count: 'exact' })
            .eq('event_id', event.id)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (searchQuery) {
            query = query.ilike('profiles.full_name', `%${searchQuery}%`)
        }

        const { data, count } = await query

        if (data) {
            setTickets(data)
            setTicketCount(count || 0)
        }
        setLoadingTickets(false)
    }

    const fetchPayouts = async () => {
        setLoadingPayouts(true)
        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('transactions')
                .select(`amount, reservations!inner(event_id)`)
                .eq('status', 'success')
                .eq('reservations.event_id', event.id)

            if (error) throw error

            const total = data.reduce((acc, tx) => acc + tx.amount, 0)
            const fee = total * 0.04 // 4% Platform Fee

            setPayoutStats({
                totalCollected: total,
                platformFee: fee,
                organizerNet: total - fee,
                transactionCount: data.length
            })
        } catch (e) {
            console.error('Payout Fetch Error:', e)
            toast.error('Failed to load payout data')
        } finally {
            setLoadingPayouts(false)
        }
    }

    // Analytics State
    const [analyticsTickets, setAnalyticsTickets] = useState<any[]>([])

    const fetchAllTickets = async () => {
        const { data } = await supabase
            .schema('gatepass')
            .from('tickets')
            .select('created_at, ticket_tiers(name)')
            .eq('event_id', event.id)
            .order('created_at', { ascending: true })

        if (data) setAnalyticsTickets(data)
    }

    useEffect(() => {
        if (activeTab === 'details') {
            fetchAllTickets()
        }
    }, [activeTab])

    useEffect(() => {
        if (activeTab === 'attendees') {
            fetchTickets(ticketPage)
        }
    }, [activeTab, ticketPage, searchQuery])

    const updateTicketStatus = async (ticketId: string, status: string) => {
        if (!confirm(`Mark as ${status}?`)) return
        const { error } = await supabase.schema('gatepass').from('tickets').update({ status }).eq('id', ticketId)
        if (error) toast.error(error.message)
        else {
            await fetchTickets(ticketPage)
            toast.success(`Ticket marked as ${status}`)
        }
    }

    // On Tab Change
    React.useEffect(() => {
        if (activeTab === 'discounts') {
            fetchDiscounts()
        }
    }, [activeTab])

    React.useEffect(() => {
        if (activeTab === 'payouts') {
            fetchPayouts()
        }
    }, [activeTab])

    const tabClass = (tab: string) => clsx(
        "px-6 py-2.5 text-sm font-bold rounded-full transition-all duration-300 ease-out",
        activeTab === tab
            ? "bg-white text-black shadow-md shadow-black/5 ring-1 ring-black/5"
            : "text-gray-500 hover:text-black hover:bg-gray-200/50"
    )

    return (
        <div className="container mx-auto p-6 max-w-5xl font-sans">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-10">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                    <Link href="/dashboard/events" className="hover:text-black transition-colors">Events</Link>
                    <ArrowLeft className="w-3 h-3 rotate-180" />
                    <span className="text-black">{event.title}</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">{event.title}</h1>
                        <div className="flex items-center gap-2 text-gray-500 font-medium">
                            <span>{event.venue_name}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span suppressHydrationWarning>{new Date(event.starts_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link href={`/events/${event.slug || event.id}`} target="_blank">
                            <button className="h-10 px-5 rounded-full border border-gray-200 bg-white font-semibold text-sm hover:border-black hover:bg-gray-50 transition-all flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Page
                            </button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex justify-start mb-10">
                <div className="inline-flex bg-gray-100/50 p-1.5 rounded-full border border-gray-200/50 relative">
                    <button onClick={() => setActiveTab('details')} className={tabClass('details')}>Overview</button>
                    <button onClick={() => setActiveTab('tickets')} className={tabClass('tickets')}>Tickets</button>
                    <button onClick={() => setActiveTab('attendees')} className={tabClass('attendees')}>Guest List</button>
                    <button onClick={() => setActiveTab('discounts')} className={tabClass('discounts')}>Promotions</button>
                    <button onClick={() => setActiveTab('payouts')} className={tabClass('payouts')}>Payouts</button>
                </div>
            </div>

            {/* PAYOUTS TAB */}
            {activeTab === 'payouts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Organizer Due Card */}
                        <div className="bg-black text-white p-8 rounded-3xl shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full translate-x-10 -translate-y-10 blur-3xl group-hover:bg-white/15 transition-colors" />
                            <div className="relative z-10">
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Organizer Payout Due</p>
                                <h2 className="text-5xl font-black tracking-tighter mb-4">
                                    {formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}
                                </h2>
                                <p className="text-sm text-gray-400">
                                    Net earnings after 4% platform fee deduction.
                                </p>
                            </div>
                        </div>

                        {/* Breakdown Card */}
                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <h3 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-4">Revenue Breakdown</h3>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Total Gross Sales</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(payoutStats.totalCollected, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Successful Transactions</span>
                                    <span className="font-bold text-gray-900">{payoutStats.transactionCount}</span>
                                </div>
                                <div className="h-px bg-gray-100 w-full" />
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">Platform Fee (4%)</span>
                                    <span className="font-bold text-red-500">
                                        - {formatCurrency(payoutStats.platformFee, initialTiers?.[0]?.currency || 'GHS')}
                                    </span>
                                </div>
                                <div className="h-px bg-gray-100 w-full" />
                                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                    <span className="font-bold text-gray-900">Net Payout</span>
                                    <span className="font-bold text-gray-900 text-lg">{formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAILS TAB */}
            {activeTab === 'details' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* 1. Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Gross Revenue</p>
                                <p className="text-2xl font-black text-gray-900">{initialTiers?.[0]?.currency || 'GHS'} {stats.totalRevenue.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center">
                                <Ticket className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Tickets Sold</p>
                                <p className="text-2xl font-black text-gray-900">{stats.totalSold} / {stats.totalCapacity}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Eye className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Views</p>
                                <p className="text-2xl font-black text-gray-900">{event.view_count?.toLocaleString() || 0}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Utilization</p>
                                <p className="text-2xl font-black text-gray-900">{stats.utilization.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* 2. Charts Row */}
                    {analyticsTickets.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-[300px]">
                                <h3 className="font-bold text-gray-900 mb-4">Sales Volume</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={aggregateSalesOverTime(analyticsTickets)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            cursor={{ stroke: '#f3f4f6', strokeWidth: 2 }}
                                        />
                                        <Line type="monotone" dataKey="count" stroke="#000000" strokeWidth={3} dot={{ r: 4, fill: '#000000' }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-[300px]">
                                <h3 className="font-bold text-gray-900 mb-4">Ticket Type Distribution</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={aggregateTicketTypes(analyticsTickets)}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {aggregateTicketTypes(analyticsTickets).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#000000', '#666666', '#999999', '#CCCCCC'][index % 4]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <form onSubmit={updateEvent} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT COLUMN (8 cols) */}
                        <div className="lg:col-span-8 space-y-8">

                            {/* General Info */}
                            <div className="p-8 rounded-3xl border border-gray-100 bg-white shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-6">
                                <div className="flex items-center gap-3 border-b pb-4 border-gray-100">
                                    <div className="p-2 bg-gray-50 rounded-xl">
                                        <ImageIcon className="w-5 h-5 text-gray-900" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">Event Identity</h3>
                                </div>
                                <div className="grid gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title</label>
                                        <input
                                            value={event.title}
                                            onChange={e => setEvent({ ...event, title: e.target.value })}
                                            className="w-full bg-gray-50 border-gray-200 rounded-xl p-3.5 text-lg font-bold focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                            placeholder="E.g. Summer Music Festival"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                        <textarea
                                            value={event.description}
                                            onChange={e => setEvent({ ...event, description: e.target.value })}
                                            rows={6}
                                            className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium resize-none"
                                            placeholder="Describe your event to attract attendees..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="p-8 rounded-3xl border border-gray-100 bg-white shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-6">
                                <div className="flex items-center gap-3 border-b pb-4 border-gray-100">
                                    <div className="p-2 bg-gray-50 rounded-xl">
                                        <MapPin className="w-5 h-5 text-gray-900" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">Location</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Name</label>
                                            <input
                                                value={event.venue_name}
                                                onChange={e => setEvent({ ...event, venue_name: e.target.value })}
                                                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium"
                                                placeholder="e.g. The National Theatre"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                                            <input
                                                value={event.venue_address}
                                                onChange={e => setEvent({ ...event, venue_address: e.target.value })}
                                                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium"
                                                placeholder="e.g. Accra, Ghana"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 border-dashed">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Latitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={event.latitude || ''}
                                                onChange={e => setEvent({ ...event, latitude: parseFloat(e.target.value) })}
                                                className="w-full bg-white border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-mono"
                                                placeholder="5.6037"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Longitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={event.longitude || ''}
                                                onChange={e => setEvent({ ...event, longitude: parseFloat(e.target.value) })}
                                                className="w-full bg-white border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-mono"
                                                placeholder="-0.1870"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Media */}
                            <div className="p-8 rounded-3xl border border-gray-100 bg-white shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-6">
                                <div className="flex items-center gap-3 border-b pb-4 border-gray-100">
                                    <div className="p-2 bg-gray-50 rounded-xl">
                                        <Video className="w-5 h-5 text-gray-900" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">Media Assets</h3>
                                </div>
                                <div className="grid gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Poster Image URL</label>
                                        <input
                                            value={event.poster_url || ''}
                                            onChange={e => setEvent({ ...event, poster_url: e.target.value })}
                                            className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium text-sm text-blue-600"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Background Video URL (Optional)</label>
                                        <input
                                            value={event.video_url || ''}
                                            onChange={e => setEvent({ ...event, video_url: e.target.value })}
                                            className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium text-sm text-blue-600"
                                            placeholder="https://... (MP4)"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">A short looping video played in the background of your event page.</p>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* RIGHT COLUMN (4 cols) - Settings */}
                        <div className="lg:col-span-4 space-y-8">

                            {/* Publish Status - High Priority */}
                            <div className="p-6 rounded-3xl bg-black text-white shadow-xl shadow-black/10">
                                <h3 className="font-bold text-lg mb-4 text-white">Visibility</h3>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-300">Publish Event</span>
                                    <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            name="toggle"
                                            id="pub"
                                            checked={event.is_published}
                                            onChange={e => setEvent({ ...event, is_published: e.target.checked })}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                            style={{ right: event.is_published ? '0' : 'auto', left: event.is_published ? 'auto' : '0' }}
                                        />
                                        <label htmlFor="pub" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${event.is_published ? 'bg-green-500' : 'bg-gray-600'}`}></label>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                                    When published, your event will be visible to the public and tickets will be available for purchase.
                                </p>
                            </div>

                            {/* Date & Time */}
                            <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-4">
                                <div className="flex items-center gap-3 pb-2">
                                    <div className="p-1.5 bg-gray-50 rounded-lg">
                                        <Calendar className="w-4 h-4 text-gray-900" />
                                    </div>
                                    <h3 className="font-bold text-gray-900">Timing</h3>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Starts</label>
                                    <DateTimePicker
                                        date={event.starts_at ? new Date(event.starts_at) : undefined}
                                        setDate={(date) => setEvent({ ...event, starts_at: date ? date.toISOString() : '' })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Ends</label>
                                    <DateTimePicker
                                        date={event.ends_at ? new Date(event.ends_at) : undefined}
                                        setDate={(date) => setEvent({ ...event, ends_at: date ? date.toISOString() : undefined })}
                                    />
                                </div>
                            </div>

                            {/* URL Slug */}
                            <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-4">
                                <div className="flex items-center gap-3 pb-2">
                                    <div className="p-1.5 bg-gray-50 rounded-lg">
                                        <Globe className="w-4 h-4 text-gray-900" />
                                    </div>
                                    <h3 className="font-bold text-gray-900">Custom URL</h3>
                                </div>
                                <div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400 mb-1">gatepass.com/events/</span>
                                        <input
                                            value={event.slug}
                                            onChange={e => setEvent({ ...event, slug: e.target.value })}
                                            className="w-full bg-gray-50 border-gray-200 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                            placeholder="my-event"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Financials */}
                            <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-4">
                                <div className="flex items-center gap-3 pb-2">
                                    <div className="p-1.5 bg-gray-50 rounded-lg">
                                        <DollarSign className="w-4 h-4 text-gray-900" />
                                    </div>
                                    <h3 className="font-bold text-gray-900">Financials</h3>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Fee Bearer</label>
                                    <select
                                        value={event.fee_bearer}
                                        onChange={e => setEvent({ ...event, fee_bearer: e.target.value as 'customer' | 'organizer' })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg p-2.5 text-sm focus:ring-black focus:border-black transition-all"
                                    >
                                        <option value="customer">Customer Pays Fees</option>
                                        <option value="organizer">Absorb Fees</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Pass-on Fee (%)</label>
                                    <input
                                        type="number"
                                        value={event.platform_fee_percent}
                                        onChange={e => setEvent({ ...event, platform_fee_percent: parseFloat(e.target.value) })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg p-2.5 text-sm focus:ring-black focus:border-black transition-all"
                                    />
                                </div>
                            </div>

                            {/* Socials */}
                            <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-4">
                                <div className="flex items-center gap-3 pb-2">
                                    <div className="p-1.5 bg-gray-50 rounded-lg">
                                        <Share2 className="w-4 h-4 text-gray-900" />
                                    </div>
                                    <h3 className="font-bold text-gray-900">Socials</h3>
                                </div>
                                <div className="grid gap-3">
                                    <input
                                        value={event.social_website || ''}
                                        onChange={e => setEvent({ ...event, social_website: e.target.value })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 text-xs focus:ring-black focus:border-black transition-all"
                                        placeholder="Website URL"
                                    />
                                    <input
                                        value={event.social_instagram || ''}
                                        onChange={e => setEvent({ ...event, social_instagram: e.target.value })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 text-xs focus:ring-black focus:border-black transition-all"
                                        placeholder="Instagram Username"
                                    />
                                    <input
                                        value={event.social_twitter || ''}
                                        onChange={e => setEvent({ ...event, social_twitter: e.target.value })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 text-xs focus:ring-black focus:border-black transition-all"
                                        placeholder="X (Twitter)"
                                    />
                                </div>
                            </div>

                            {/* Save Action - Sticky at bottom of column */}
                            <div className="sticky bottom-6 pt-4">
                                <button
                                    type="submit"
                                    className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 shadow-xl hover:shadow-2xl hover:-translate-y-1 text-lg"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving Update...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm('Delete event?')) return
                                        // Delete logic
                                        const { error } = await supabase.schema('gatepass').from('events').delete().eq('id', event.id)
                                        if (error) alert(error.message); else router.push('/dashboard/events')
                                    }}
                                    className="w-full mt-3 text-red-500 font-bold text-sm hover:underline py-2"
                                >
                                    Delete Event
                                </button>
                            </div>

                        </div>
                    </form>
                </div>
            )}

            {/* TICKETS TAB */}
            {activeTab === 'tickets' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid lg:grid-cols-2 gap-6">
                        {tiers.map(tier => (
                            <div key={tier.id} className="relative group bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                                {editingTierId === tier.id ? (
                                    // Editing Mode
                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Name</label>
                                            <input
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-bold text-gray-900"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Price</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={editForm.price}
                                                        onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
                                                        className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 pl-8 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-bold text-gray-900"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Quantity</label>
                                                <input
                                                    type="number"
                                                    value={editForm.total_quantity}
                                                    onChange={e => setEditForm({ ...editForm, total_quantity: Number(e.target.value) })}
                                                    className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-bold text-gray-900"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Description</label>
                                            <textarea
                                                value={editForm.description}
                                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium resize-none text-sm"
                                                rows={2}
                                                placeholder="Short description..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Perks (Comma separated)</label>
                                            <input
                                                value={editForm.perks?.join(', ') || ''}
                                                onChange={e => setEditForm({ ...editForm, perks: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none font-medium text-sm"
                                                placeholder="e.g. VIP Access, Free Drink"
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end pt-2">
                                            <button onClick={cancelEditing} className="px-4 py-2 rounded-xl font-bold text-sm text-gray-500 hover:text-black hover:bg-gray-50 transition-colors">Cancel</button>
                                            <button onClick={() => saveTier(tier.id)} className="px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-900 shadow-md hover:shadow-lg transition-all">Save Changes</button>
                                        </div>
                                    </div>
                                ) : (
                                    // Viewing Mode
                                    <div className="flex flex-col h-full justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-extrabold text-xl text-gray-900 tracking-tight">{tier.name}</h4>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEditing(tier)}
                                                        className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTier(tier.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <span className="text-3xl font-black text-gray-900">{formatCurrency(tier.price, tier.currency)}</span>
                                                <span className="text-gray-400 text-sm font-medium ml-1">/ ticket</span>
                                            </div>

                                            {tier.description && (
                                                <p className="text-sm text-gray-500 mb-5 leading-relaxed border-l-2 border-gray-100 pl-3">
                                                    {tier.description}
                                                </p>
                                            )}

                                            {/* Perks List */}
                                            {tier.perks && tier.perks.length > 0 && (
                                                <div className="mb-6 space-y-2">
                                                    {tier.perks.map((perk, i) => (
                                                        <div key={i} className="flex items-center gap-2.5 text-sm text-gray-700 font-medium">
                                                            <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                                                                <Check className="w-3 h-3" strokeWidth={3} />
                                                            </div>
                                                            {perk}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50 mt-auto">
                                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                                <span>Sales Progress</span>
                                                <span>{Math.round((tier.quantity_sold / tier.total_quantity) * 100)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${(tier.quantity_sold / tier.total_quantity) >= 1 ? 'bg-red-500' : 'bg-black'
                                                        }`}
                                                    style={{ width: `${Math.min((tier.quantity_sold / tier.total_quantity) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <div className="text-lg font-black text-gray-900">{tier.quantity_sold}</div>
                                                    <div className="text-[10px] uppercase font-bold text-gray-400">Sold</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-gray-400">{tier.total_quantity}</div>
                                                    <div className="text-[10px] uppercase font-bold text-gray-400">Total Capacity</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Add New Tier Card */}
                        <div className="bg-gray-50/50 p-6 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col justify-center hover:border-gray-300 transition-colors">
                            <h3 className="font-bold text-xl mb-6 text-center text-gray-900">Add New Ticket Tier</h3>
                            <form onSubmit={addTier} className="space-y-4">
                                <div>
                                    <input
                                        value={tierForm.name}
                                        onChange={e => setTierForm({ ...tierForm, name: e.target.value })}
                                        required
                                        placeholder="Ticket Name (e.g. VIP)"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-bold text-gray-900"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        value={tierForm.price}
                                        onChange={e => setTierForm({ ...tierForm, price: Number(e.target.value) })}
                                        required
                                        placeholder="Price"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-bold text-gray-900"
                                    />
                                    <input
                                        type="number"
                                        value={tierForm.total_quantity}
                                        onChange={e => setTierForm({ ...tierForm, total_quantity: Number(e.target.value) })}
                                        required
                                        placeholder="Quantity"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-bold text-gray-900"
                                    />
                                </div>
                                <div>
                                    <textarea
                                        value={tierForm.description || ''}
                                        onChange={e => setTierForm({ ...tierForm, description: e.target.value })}
                                        placeholder="Description (optional)"
                                        rows={2}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium resize-none text-sm"
                                    />
                                </div>
                                <div>
                                    <input
                                        value={tierForm.perks?.join(', ') || ''}
                                        onChange={e => setTierForm({ ...tierForm, perks: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                        placeholder="Perks (comma separated, e.g. Free Drink)"
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-sm"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-black text-white py-3.5 rounded-xl font-bold shadow-lg shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                    disabled={creatingTier}
                                >
                                    {creatingTier ? 'Adding...' : 'Add Tier'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ATTENDEES TAB */}
            {activeTab === 'attendees' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-xl text-gray-900">Guest List</h3>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search details..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setTicketPage(0) // Reset page on search
                                    }}
                                    className="pl-9 pr-4 py-1.5 w-64 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const csv = generateCSV(tickets)
                                    downloadCSV(csv, `${event.slug}-guests.csv`)
                                }}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                            <button
                                onClick={() => setIsCheckInMode(!isCheckInMode)}
                                className={clsx("flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all border", {
                                    'bg-green-500 text-white border-green-600 shadow-md shadow-green-500/20': isCheckInMode,
                                    'bg-white text-gray-700 border-gray-200 hover:bg-gray-50': !isCheckInMode
                                })}
                            >
                                <ScanLine className="w-4 h-4" />
                                {isCheckInMode ? 'Check-in Mode' : 'Check-in'}
                            </button>
                        </div>
                    </div>

                    {loadingTickets ? (
                        <div className="p-12 text-center text-gray-500 animate-pulse">Loading guest list...</div>
                    ) : tickets.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Reference</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Guest</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Ticket</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Net Payout</th>
                                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {tickets.map((ticket: any) => (
                                        <tr key={ticket.id} className={clsx("hover:bg-gray-50/80 transition-colors group", {
                                            'opacity-40 grayscale': isCheckInMode && ticket.status !== 'valid'
                                        })}>
                                            <td className="px-8 py-5 font-mono text-xs text-gray-500">{ticket.order_reference?.substring(0, 8) || 'N/A'}</td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 border border-white shadow-sm ring-1 ring-gray-100">
                                                        {ticket.profiles?.full_name?.charAt(0) || 'G'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 group-hover:text-black transition-colors">{ticket.profiles?.full_name || 'Guest User'}</div>
                                                        <div className="text-xs text-gray-400 font-mono tracking-tight">{ticket.profiles?.id.slice(0, 8)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-100">
                                                    {ticket.ticket_tiers?.name}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="font-mono text-xs font-bold text-gray-700">
                                                    {formatCurrency(
                                                        calculateFees(ticket.ticket_tiers?.price || 0, event.fee_bearer as 'customer' | 'organizer').organizerPayout,
                                                        ticket.ticket_tiers?.currency
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={clsx("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border", {
                                                    'bg-green-50 text-green-700 border-green-200/50': ticket.status === 'valid',
                                                    'bg-gray-50 text-gray-500 border-gray-200/50': ticket.status === 'used',
                                                    'bg-red-50 text-red-700 border-red-200/50': ticket.status === 'cancelled'
                                                })}>
                                                    <span className={clsx("w-1.5 h-1.5 rounded-full", {
                                                        'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]': ticket.status === 'valid',
                                                        'bg-gray-400': ticket.status === 'used',
                                                        'bg-red-500': ticket.status === 'cancelled'
                                                    })}></span>
                                                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                {ticket.status === 'valid' && (
                                                    <button
                                                        onClick={() => updateTicketStatus(ticket.id, 'used')}
                                                        className={clsx("font-bold bg-black text-white rounded-lg hover:bg-gray-800 transition-all shadow-md shadow-black/10 hover:shadow-lg hover:-translate-y-0.5", {
                                                            'px-6 py-3 text-sm w-full': isCheckInMode,
                                                            'px-4 py-2 text-xs': !isCheckInMode
                                                        })}
                                                    >
                                                        Check In
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-24 text-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                            </div>
                            <h3 className="text-gray-900 font-bold text-lg mb-2">No tickets sold yet</h3>
                            <p className="text-gray-500">When people purchase tickets, they will appear here.</p>
                        </div>
                    )}

                    {/* Pagination Footer */}
                    {tickets.length > 0 && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50/30 flex items-center justify-between">
                            <p className="text-xs text-gray-500 font-medium">
                                Showing <span className="font-bold text-gray-900">{ticketPage * TICKETS_PER_PAGE + 1}</span> to <span className="font-bold text-gray-900">{Math.min((ticketPage + 1) * TICKETS_PER_PAGE, ticketCount)}</span> of <span className="font-bold text-gray-900">{ticketCount}</span> results
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTicketPage(p => Math.max(0, p - 1))}
                                    disabled={ticketPage === 0 || loadingTickets}
                                    className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setTicketPage(p => p + 1)}
                                    disabled={(ticketPage + 1) * TICKETS_PER_PAGE >= ticketCount || loadingTickets}
                                    className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* DISCOUNTS TAB */}
            {activeTab === 'discounts' && (
                <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl">{editingDiscountId ? 'Edit Discount Code' : 'Create Discount Code'}</h3>
                            {editingDiscountId && (
                                <button
                                    onClick={cancelEditingDiscount}
                                    className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleSaveDiscount} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Code</label>
                                <input
                                    required
                                    value={discountForm.code}
                                    onChange={e => setDiscountForm({ ...discountForm, code: e.target.value })}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all uppercase font-medium"
                                    placeholder="e.g. EARLYBIRD"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Type</label>
                                <div className="relative">
                                    <select
                                        value={discountForm.type}
                                        onChange={e => setDiscountForm({ ...discountForm, type: e.target.value as 'percentage' | 'fixed' })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium appearance-none"
                                    >
                                        <option value="percentage">Percent (%)</option>
                                        <option value="fixed">Fixed Amount</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Value</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={discountForm.value}
                                    onChange={e => setDiscountForm({ ...discountForm, value: parseFloat(e.target.value) })}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Limit (Optional)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={discountForm.max_uses}
                                    onChange={e => setDiscountForm({ ...discountForm, max_uses: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium"
                                    placeholder="∞"
                                />
                            </div>
                            <div className="md:col-span-4 flex justify-end pt-2">
                                <button
                                    disabled={creatingDiscount}
                                    className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-all"
                                >
                                    {creatingDiscount ? 'Saving...' : (editingDiscountId ? 'Update Discount' : 'Create Discount')}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="grid gap-4">
                        {discounts.map(discount => (
                            <div key={discount.id} className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center font-bold text-xl border border-green-100">
                                        %
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-lg tracking-tight">{discount.code}</h4>
                                            <button
                                                onClick={() => copyCode(discount.code, discount.id)}
                                                className="text-gray-400 hover:text-black transition-colors p-1"
                                                title="Copy Code"
                                            >
                                                {copiedId === discount.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-sm font-medium text-gray-500">
                                            {discount.type === 'percentage' ? `${discount.value}% OFF` : `-$${discount.value}`}
                                            <span className="mx-2 text-gray-300">|</span>
                                            Used: {discount.used_count || 0} {discount.max_uses ? `/ ${discount.max_uses}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => startEditingDiscount(discount)}
                                        className="text-gray-400 hover:text-black font-bold text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deleteDiscount(discount.id)}
                                        className="text-gray-400 hover:text-red-600 font-bold text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                        {discounts.length === 0 && (
                            <div className="text-center py-24 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                    <span className="font-bold text-2xl">%</span>
                                </div>
                                <p className="font-medium">No discount codes created yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
