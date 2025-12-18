'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Globe, DollarSign, Users, BarChart3, Share2, Video, ImageIcon, Ticket, Plus, Search, ScanLine, Filter, Check, Edit2, Trash2, Eye, Copy, Download, ShieldCheck, Mail } from 'lucide-react'
import { Event, TicketTier, Discount, EventStaff } from '@/types/gatepass'
import { createEventStaff, fetchEventStaff, deleteEventStaff } from '@/utils/actions/staff'
import clsx from 'clsx'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import dynamic from 'next/dynamic'
import { aggregateSalesOverTime, aggregateTicketTypes, generateCSV, downloadCSV } from '@/utils/analytics'
import { logActivity } from '@/app/actions/logger'

const DateTimePicker = dynamic(() => import('@/components/common/DateTimePicker').then(mod => mod.DateTimePicker), { ssr: false })
const AnalyticsCharts = dynamic(() => import('@/components/admin/AnalyticsCharts'), {
    loading: () => <div className="h-[300px] w-full bg-gray-50/50 rounded-3xl animate-pulse" />,
    ssr: false
})
import { StaffTab } from '@/components/admin/tabs/StaffTab'
import { AttendeesTab } from '@/components/admin/tabs/AttendeesTab'
import { TicketsTab } from '@/components/admin/tabs/TicketsTab'
import { RichTextEditor } from '@/components/common/RichTextEditor'


interface EventManageClientProps {
    event: Event
    initialTiers: TicketTier[]
}

export function EventManageClient({ event: initialEvent, initialTiers }: EventManageClientProps) {
    const [event, setEvent] = useState(initialEvent)
    const [activeTab, setActiveTab] = useState<'details' | 'tickets' | 'attendees' | 'discounts' | 'payouts' | 'team'>('tickets')
    const [loading, setLoading] = useState(false)

    // Tickets State
    const [tiers, setTiers] = useState<TicketTier[]>(initialTiers) // Kept initialTiers from props




    // Discounts State
    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [discountForm, setDiscountForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed', value: 0, max_uses: 0, tier_id: '' })
    const [creatingDiscount, setCreatingDiscount] = useState(false)
    const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)

    // Payouts State
    const [payoutStats, setPayoutStats] = useState({ totalCollected: 0, platformFee: 0, organizerNet: 0, transactionCount: 0 })
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingPayouts, setLoadingPayouts] = useState(false)


    const [copiedId, setCopiedId] = useState<string | null>(null)

    const [isAdmin, setIsAdmin] = useState(false)

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code)
        setCopiedId(id)
        toast.success('Code copied!')
        setTimeout(() => setCopiedId(null), 2000)
    }

    const supabase = createClient()
    const router = useRouter()

    // Check Admin Status
    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !event.organization_id) return

            // 1. Check if Owner
            const { data: org } = await supabase.schema('gatepass').from('organizers').select('user_id').eq('id', event.organization_id).single()
            if (org && org.user_id === user.id) {
                setIsAdmin(true)
                return
            }

            // 2. Check if Team Admin
            const { data: teamMember } = await supabase.schema('gatepass').from('organization_team')
                .select('role')
                .eq('organization_id', event.organization_id)
                .eq('user_id', user.id)
                .single()

            if (teamMember && teamMember.role === 'admin') {
                setIsAdmin(true)
            }
        }
        checkAdmin()
    }, [event.organization_id])

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

            // Log Activity
            await logActivity(event.organization_id || '', 'update_event', 'event', event.id, { title: event.title })

            toast.success('Event updated successfully')
            router.refresh()
        } catch (e: any) {
            toast.error('Error: ' + e.message)
        } finally {
            setLoading(false)
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
                    tier_id: discountForm.tier_id || null
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
                    used_count: 0,
                    tier_id: discountForm.tier_id || null
                })

                if (error) throw error
                toast.success('Discount code created!')
            }

            await fetchDiscounts()
            await fetchDiscounts()
            setDiscountForm({ code: '', type: 'percentage', value: 0, max_uses: 0, tier_id: '' })
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
            max_uses: discount.max_uses || 0,
            tier_id: discount.tier_id || ''
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEditingDiscount = () => {
        setEditingDiscountId(null)
        setDiscountForm({ code: '', type: 'percentage', value: 0, max_uses: 0, tier_id: '' })
    }

    const deleteDiscount = (id: string) => {
        toast('Are you sure you want to delete this discount code?', {
            action: {
                label: 'Delete',
                onClick: async () => {
                    const { error } = await supabase.schema('gatepass').from('discounts').delete().eq('id', id)
                    if (error) toast.error(error.message)
                    else {
                        await fetchDiscounts()
                        toast.success('Discount deleted')
                    }
                }
            }
        })
    }





    // ... (rest of code)

    // Updated Payouts Logic
    const fetchPayouts = async () => {
        setLoadingPayouts(true)
        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('transactions')
                .select(`
                    *,
                    reservations!inner (
                        event_id,
                        tier_id,
                        quantity,
                        guest_name,
                        guest_email,
                        profiles ( full_name, email )
                    )
                `)
                .eq('status', 'success')
                .eq('reservations.event_id', event.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            setTransactions(data || [])

            // Calculate exact payout based on ticket sales, not just raw transaction totals
            // This ensures we respect the fee_bearer setting (customer vs organizer)
            let totalVolume = 0 // Total processed (TPV)
            let totalPlatformFees = 0
            let totalNetParams = 0

            data.forEach(tx => {
                totalVolume += (tx.amount || 0)

                // Find tier price
                const tier = tiers.find(t => t.id === tx.reservations?.tier_id)
                const price = tier?.price || 0
                const quantity = tx.reservations?.quantity || 1
                const subtotal = price * quantity

                // Use centralized fee logic
                const fees = calculateFees(subtotal, event.fee_bearer as 'customer' | 'organizer')

                totalPlatformFees += fees.platformFee + fees.processorFee // Total fees deducted/collected
                totalNetParams += fees.organizerPayout
            })

            setPayoutStats({
                totalCollected: totalVolume,
                platformFee: totalPlatformFees,
                organizerNet: totalNetParams,
                transactionCount: data.length
            })
        }

        catch (e) {
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
                    <button onClick={() => setActiveTab('team')} className={tabClass('team')}>Team</button>
                    {isAdmin && (
                        <button onClick={() => setActiveTab('payouts')} className={tabClass('payouts')}>Payouts</button>
                    )}
                </div>
            </div>

            {/* PAYOUTS TAB */}
            {activeTab === 'payouts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Organizer Due Card */}
                        <div className="bg-black text-white p-10 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full translate-x-10 -translate-y-10 blur-3xl group-hover:bg-white/10 transition-colors duration-500" />
                            <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                            <DollarSign className="w-4 h-4 text-white" />
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-widest text-white/60">Balance Due</p>
                                    </div>
                                    <h2 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
                                        {formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}
                                    </h2>
                                </div>
                                <div className="p-4 rounded-xl bg-white/10 border border-white/5 backdrop-blur-sm">
                                    <p className="text-sm text-gray-300 leading-relaxed font-medium">
                                        This is your net payout after platform fees (4%). Payouts are processed weekly on Mondays.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Card */}
                        <div className="bg-white p-10 rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-6">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-gray-400" />
                                    Financial Summary
                                </h3>
                                <div className="text-xs font-bold px-3 py-1 bg-gray-100 rounded-full text-gray-500">
                                    Real-time
                                </div>
                            </div>

                            <div className="space-y-5 flex-1">
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 font-medium group-hover:text-black transition-colors">Gross Sales Volume</span>
                                    <span className="font-bold text-gray-900 text-lg tabular-nums">{formatCurrency(payoutStats.totalCollected, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 font-medium group-hover:text-black transition-colors">Total Transactions</span>
                                    <span className="font-bold text-gray-900 text-lg tabular-nums">{payoutStats.transactionCount}</span>
                                </div>
                                <div className="h-px bg-gray-100 w-full" />
                                <div className="flex justify-between items-center group">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 font-medium group-hover:text-red-500 transition-colors">Platform Fees</span>
                                        <span className="text-[10px] text-gray-400 font-medium">4% processing fee</span>
                                    </div>
                                    <span className="font-bold text-red-500 text-lg tabular-nums">
                                        - {formatCurrency(payoutStats.platformFee, initialTiers?.[0]?.currency || 'GHS')}
                                    </span>
                                </div>
                                <div className="h-px bg-gray-100 w-full" />
                                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="font-bold text-gray-900">Net Earnings</span>
                                    <span className="font-black text-gray-900 text-xl tabular-nums tracking-tight">{formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transaction History Table */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                        <div className="px-8 py-8 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                                    <ScanLine className="w-5 h-5 text-gray-900" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-gray-900">Recent Transactions</h3>
                                    <p className="text-sm text-gray-500 font-medium">{transactions.length} successful payments found</p>
                                </div>
                            </div>
                            <button
                                onClick={() => downloadCSV(transactions, `gatepass-transactions-${event.slug}`)}
                                disabled={transactions.length === 0}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/10 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        </div>

                        {transactions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400">Time</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400">Customer</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400">Reference</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Amount</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {transactions.map((tx: any) => (
                                            <tr key={tx.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-gray-200 group-hover:bg-black transition-colors" />
                                                        <div>
                                                            <div className="font-bold text-gray-900">
                                                                {new Date(tx.paid_at || tx.created_at).toLocaleDateString()}
                                                            </div>
                                                            <div className="text-xs text-gray-400 font-medium">
                                                                {new Date(tx.paid_at || tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 border border-white shadow-sm">
                                                            {(tx.reservations?.profiles?.full_name || tx.reservations?.guest_name || '?')[0]}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-900">
                                                                {tx.reservations?.profiles?.full_name || tx.reservations?.guest_name || 'Guest User'}
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-medium">
                                                                {tx.reservations?.profiles?.email || tx.reservations?.guest_email || 'No email'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="font-mono text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md inline-block border border-gray-100 select-all">
                                                        {tx.reference}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className="font-bold text-gray-900 tabular-nums">
                                                        {formatCurrency(tx.amount, tx.currency)}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm ${tx.status === 'success'
                                                        ? 'bg-[#E8FCEC] text-[#145D25] border border-[#BCF0C6]'
                                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                        }`}>
                                                        {tx.status === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-[#145D25]" />}
                                                        {tx.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-20 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <ScanLine className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">No transactions yet</h3>
                                <p className="text-gray-500 max-w-xs mx-auto">
                                    When people buy tickets, their payments will appear here in real-time.
                                </p>
                            </div>
                        )}
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
                        <AnalyticsCharts tickets={analyticsTickets} />
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
                                        <RichTextEditor
                                            value={event.description}
                                            onChange={(value) => setEvent({ ...event, description: value })}
                                            placeholder="Describe your event to attract attendees..."
                                        />
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
                                    <p className="text-xs text-gray-400 mt-2">
                                        If 'Customer Pays', fees are added to the ticket price. If 'Absorb', fees are deducted from your earnings.
                                    </p>
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
            {/* TICKETS TAB */}
            {activeTab === 'tickets' && (
                <TicketsTab event={event} tiers={tiers} onTiersUpdate={setTiers} />
            )}

            {/* ATTENDEES TAB */}
            {
                activeTab === 'attendees' && (
                    <AttendeesTab event={event} />
                )
            }

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
                        <form onSubmit={handleSaveDiscount} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
                                    value={isNaN(discountForm.value) ? '' : discountForm.value}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value)
                                        setDiscountForm({ ...discountForm, value: isNaN(val) ? 0 : val })
                                    }}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Total Usage Limit</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={discountForm.max_uses}
                                    onChange={e => setDiscountForm({ ...discountForm, max_uses: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium"
                                    placeholder="∞"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Applies To</label>
                                <div className="relative">
                                    <select
                                        value={discountForm.tier_id || ''}
                                        onChange={e => setDiscountForm({ ...discountForm, tier_id: e.target.value })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium appearance-none truncate pr-8"
                                    >
                                        <option value="">All Tiers</option>
                                        {tiers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-5 flex justify-end pt-2">
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
                                        <p className="text-sm font-medium text-gray-500 mt-1">
                                            {discount.type === 'percentage' ? `${discount.value}% OFF` : `-$${discount.value}`}
                                            <span className="mx-2 text-gray-300">|</span>
                                            Used: {discount.used_count || 0} {discount.max_uses ? `/ ${discount.max_uses}` : ''}
                                            <span className="mx-2 text-gray-300">|</span>
                                            <span className={clsx("text-xs uppercase font-bold tracking-wider", discount.tier_id ? "text-purple-600" : "text-gray-400")}>
                                                {discount.tier_id ? (tiers.find(t => t.id === discount.tier_id)?.name || 'Specific Tier') : 'All Tickets'}
                                            </span>
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

            {/* PAYOUTS TAB */}
            {activeTab === 'payouts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                            <h4 className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Total Revenue</h4>
                            <p className="text-3xl font-bold text-gray-900">{formatCurrency(payoutStats.totalCollected, event.currency)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                            <h4 className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Platform Fees</h4>
                            <p className="text-3xl font-bold text-gray-900">{formatCurrency(payoutStats.platformFee, event.currency)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                            <h4 className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Net Payout</h4>
                            <p className="text-3xl font-bold text-green-600">{formatCurrency(payoutStats.organizerNet, event.currency)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                            <h4 className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">Transactions</h4>
                            <p className="text-3xl font-bold text-gray-900">{payoutStats.transactionCount}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100">
                            <h3 className="font-bold text-xl text-gray-900">Recent Transactions</h3>
                        </div>
                        {loadingPayouts ? (
                            <div className="p-12 text-center text-gray-500 animate-pulse">Loading transaction history...</div>
                        ) : transactions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Reference</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Customer</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Items</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {transactions.map((tx: any) => (
                                            <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-8 py-5 text-gray-500 font-mono text-xs">
                                                    {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-8 py-5 font-mono text-xs text-gray-500">{tx.gateway_reference?.substring(0, 12)}...</td>
                                                <td className="px-8 py-5">
                                                    <div>
                                                        <div className="font-bold text-gray-900">{tx.reservations?.guest_name || tx.reservations?.profiles?.full_name || 'Guest'}</div>
                                                        <div className="text-xs text-gray-400">{tx.reservations?.guest_email || tx.reservations?.profiles?.email}</div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        {(tiers.find(t => t.id === tx.reservations?.tier_id)?.name || 'Ticket')} x {tx.reservations?.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-mono font-bold text-gray-900">
                                                    {formatCurrency(tx.amount, tx.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-24 text-center">
                                <p className="text-gray-500">No transactions recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TEAM TAB */}
            {activeTab === 'team' && (
                <StaffTab eventId={event.id} />
            )}
        </div>
    )
}
