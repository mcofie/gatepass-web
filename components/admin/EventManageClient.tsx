'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Globe, DollarSign, Users, BarChart3, Share2, Video, ImageIcon, Ticket, Plus, Search, ScanLine, Filter, Check, Edit2, Trash2, Eye, Copy, Download, ShieldCheck, Mail, Loader2 } from 'lucide-react'
import { Event, TicketTier, Discount, EventStaff } from '@/types/gatepass'
import { createEventStaff, fetchEventStaff, deleteEventStaff } from '@/utils/actions/staff'
import clsx from 'clsx'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'
import { calculateFees, FeeRates, getEffectiveFeeRates } from '@/utils/fees'
import dynamic from 'next/dynamic'
import { aggregateSalesOverTime, aggregateTicketTypes, generateCSV, downloadCSV } from '@/utils/analytics'
import { logActivity } from '@/app/actions/logger'
import { updateEventFee, updateEventFeeBearer } from '@/app/actions/fees'
import { requestPayout } from '@/app/actions/payouts'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const DateTimePicker = dynamic(() => import('@/components/common/DateTimePicker').then(mod => mod.DateTimePicker), { ssr: false })
const AnalyticsCharts = dynamic(() => import('@/components/admin/AnalyticsCharts'), {
    loading: () => <div className="h-[300px] w-full bg-gray-50/50 rounded-3xl animate-pulse" />,
    ssr: false
})
import { StaffTab } from '@/components/admin/tabs/StaffTab'
import { AttendeesTab } from '@/components/admin/tabs/AttendeesTab'
import { TicketsTab } from '@/components/admin/tabs/TicketsTab'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { TransactionDetailModal } from '@/components/admin/TransactionDetailModal'
import { DeleteEventModal } from '@/components/admin/DeleteEventModal'
import { LineupTab } from '@/components/admin/tabs/LineupTab'
import { AddonsTab } from '@/components/admin/tabs/AddonsTab'


interface EventManageClientProps {
    event: Event
    initialTiers: TicketTier[]
    initialTotalRevenue?: number
    initialTotalDiscountValue?: number
    userRole: string
    feeRates?: FeeRates
    isSuperAdmin?: boolean
}

export function EventManageClient({
    event: initialEvent,
    initialTiers,
    initialTotalRevenue = 0,
    initialTotalDiscountValue = 0,
    userRole,
    feeRates,
    isSuperAdmin = false
}: EventManageClientProps) {
    const isStaff = userRole === 'Staff'
    const isAdmin = userRole === 'Owner' || userRole === 'Admin'
    const [event, setEvent] = useState(initialEvent)
    const [activeTab, setActiveTab] = useState<'details' | 'tickets' | 'attendees' | 'discounts' | 'payouts' | 'team' | 'lineup' | 'addons'>('tickets')
    const [loading, setLoading] = useState(false)
    const [addons, setAddons] = useState<any[]>([])

    // Tickets State
    const [tiers, setTiers] = useState<TicketTier[]>(initialTiers) // Kept initialTiers from props




    // Discounts State
    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [discountForm, setDiscountForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed', value: 0, max_uses: 0, tier_id: '' })
    const [creatingDiscount, setCreatingDiscount] = useState(false)
    const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)

    // Payouts State
    const [payoutStats, setPayoutStats] = useState({ totalCollected: 0, platformFee: 0, organizerNet: 0, transactionCount: 0, totalAddons: 0 })
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingPayouts, setLoadingPayouts] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
    const [payoutPage, setPayoutPage] = useState(0)
    const [payoutCount, setPayoutCount] = useState(0)
    const [activePayout, setActivePayout] = useState<any>(null)

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const [feeSaving, setFeeSaving] = useState(false)
    const [feeInput, setFeeInput] = useState<string>(event.platform_fee_percent ? (event.platform_fee_percent * 100).toString() : '')

    // Slug Validation State
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
    const [originalSlug] = useState(initialEvent.slug) // Track original slug to skip validation if unchanged

    // Determine current effective source
    const feeSource = React.useMemo(() => {
        if (event.platform_fee_percent && event.platform_fee_percent > 0) return 'Event Specific'
        if (event.organizers?.platform_fee_percent && event.organizers.platform_fee_percent > 0) return 'Organizer Default'
        return 'System Default'
    }, [event])

    // Fetch data on load
    useEffect(() => {
        const fetchDeepData = async () => {
            const supabase = createClient()

            // Fetch Addons
            const { data: addonsData } = await supabase
                .schema('gatepass')
                .from('event_addons')
                .select('*')
                .eq('event_id', event.id)
                .order('price', { ascending: true })

            if (addonsData) setAddons(addonsData)
        }
        fetchDeepData()
    }, [event.id])

    // Debounced slug validation
    useEffect(() => {
        const checkSlug = async () => {
            // Skip if slug is empty or unchanged from original
            if (!event.slug || event.slug === originalSlug) {
                setSlugStatus('idle')
                return
            }

            setSlugStatus('checking')
            try {
                const { data, error } = await supabase
                    .schema('gatepass')
                    .from('events')
                    .select('id')
                    .eq('slug', event.slug)
                    .neq('id', event.id) // Exclude current event
                    .single()

                if (data) {
                    setSlugStatus('taken')
                } else {
                    setSlugStatus('available')
                }
            } catch (e) {
                // If error is "row not found", then it's available
                setSlugStatus('available')
            }
        }

        const timeoutId = setTimeout(checkSlug, 500)
        return () => clearTimeout(timeoutId)
    }, [event.slug, event.id, originalSlug])

    // Callback to refresh addons
    const refreshAddons = async () => {
        const supabase = createClient()
        const { data: addonsData } = await supabase
            .schema('gatepass')
            .from('event_addons')
            .select('*')
            .eq('event_id', event.id)
            .order('price', { ascending: true })
        if (addonsData) setAddons(addonsData)
    }

    const handleSaveFee = async () => {
        setFeeSaving(true)
        try {
            const val = feeInput ? parseFloat(feeInput) / 100 : null
            await updateEventFee(event.id, val)
            toast.success('Event fee updated')
            // Update local state to reflect change? Revalidation handles it but optimistic UI is nice.
            setEvent({ ...event, platform_fee_percent: val ?? 0 }) // Assuming 0 if null for local usage or proper type
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setFeeSaving(false)
        }
    }


    const [copiedId, setCopiedId] = useState<string | null>(null)

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code)
        setCopiedId(id)
        toast.success('Code copied!')
        setTimeout(() => setCopiedId(null), 2000)
    }

    const [requestingPayout, setRequestingPayout] = useState(false)

    const handleRequestPayout = async () => {
        if (requestingPayout) return

        if (payoutStats.organizerNet <= 0) {
            toast.error('No balance available to checkout.')
            return
        }

        setRequestingPayout(true)
        try {
            const result = await requestPayout(
                event.id,
                payoutStats.organizerNet,
                initialTiers?.[0]?.currency || 'GHS'
            )

            if (result.success) {
                toast.success('Payout request submitted successfully.')
                fetchPayouts()
            } else {
                toast.error(result.message || 'Failed to request payout')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setRequestingPayout(false)
        }
    }

    const supabase = createClient()
    const router = useRouter()

    // Stats Calculation
    const stats = React.useMemo(() => {
        // Use passed initialTotalRevenue if available (Server Calculated), otherwise fallback to estimate (less accurate)
        // Note: Ideally if we update Tiers locally we might want to re-fetch, but for "Gross Revenue" usually server-truth is best.
        // We will default to the prop value.
        const totalRevenue = initialTotalRevenue
        const totalSold = tiers.reduce((acc, tier) => acc + tier.quantity_sold, 0)
        const totalCapacity = tiers.reduce((acc, tier) => acc + tier.total_quantity, 0)
        const utilization = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0
        return { totalRevenue, totalSold, totalCapacity, utilization }
    }, [tiers, initialTotalRevenue])

    // ---------------- DETAILS LOGIC ----------------
    const updateEvent = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setLoading(true)
        try {
            // Validate slug availability
            if (slugStatus === 'taken') {
                throw new Error('This URL slug is already taken. Please choose a different one.')
            }

            if (event.is_published && tiers.length === 0) {
                throw new Error('You must create at least one ticket tier before publishing.')
            }

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
                logo_url: event.logo_url,
                is_published: event.is_published,
                fee_bearer: event.fee_bearer,
                platform_fee_percent: event.platform_fee_percent,
                primary_color: event.primary_color,
                lineup: event.lineup
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

    // Payout Logic with Pagination
    const fetchPayouts = async () => {
        setLoadingPayouts(true)
        try {
            // 1. Fetch Stats (All Data, minimal fields)
            // We need to fetch all successful transactions to calculate the total balance due accurately.
            const statsQuery = supabase
                .schema('gatepass')
                .from('transactions')
                .select(`
                    amount,
                    platform_fee,
                    applied_processor_fee,
                    applied_fee_rate,
                    applied_processor_rate,
                    reservations!inner (
                        tier_id,
                        quantity,
                        discounts ( type, value ),
                        ticket_tiers ( price ),
                        addons
                    )
                `)
                .eq('status', 'success')
                .eq('reservations.event_id', event.id)

            // 2. Fetch Page Data (Detailed fields)
            const PAGE_SIZE = 20
            const from = payoutPage * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            const listQuery = supabase
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
                        discounts ( type, value, code ),
                        profiles ( full_name, email ),
                        ticket_tiers ( price ),
                        addons
                    )
                `, { count: 'exact' })
                .eq('status', 'success')
                .eq('reservations.event_id', event.id)
                .order('created_at', { ascending: false })
                .range(from, to)

            // 3. Fetch Active Payout Request
            const activePayoutQuery = supabase
                .schema('gatepass')
                .from('payouts')
                .select('*')
                .eq('event_id', event.id)
                .in('status', ['pending', 'processing'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            const [statsRes, listRes, activePayoutRes] = await Promise.all([statsQuery, listQuery, activePayoutQuery])

            if (statsRes.error) throw statsRes.error
            if (listRes.error) throw listRes.error
            if (activePayoutRes.error) throw activePayoutRes.error

            setTransactions(listRes.data || [])
            setPayoutCount(listRes.count || 0)
            setActivePayout(activePayoutRes.data)

            // Calculate exact payout stats from the FULL statsRes dataset
            let totalVolume = 0
            let totalPlatformFees = 0
            let totalOrganizerNet = 0 // Using explicit independent counter
            let totalAddonsRevenue = 0

            // Helper to get addon price (uses 'addons' state which is fetched on mount)
            const getAddonPrice = (id: string) => {
                const found = addons.find(a => a.id === id)
                return found?.price || 0
            }

            statsRes.data.forEach((tx: any) => {
                totalVolume += (tx.amount || 0)

                // Find tier price directly from relation if available, else fallback
                const price = tx.reservations?.ticket_tiers?.price || tiers.find(t => t.id === tx.reservations?.tier_id)?.price || 0
                const quantity = tx.reservations?.quantity || 1

                // Calculate Addon Revenue for this TX
                const resAddons = tx.reservations?.addons
                let txAddonRevenue = 0
                if (resAddons && typeof resAddons === 'object') {
                    Object.entries(resAddons).forEach(([addonId, qty]) => {
                        const unitPrice = getAddonPrice(addonId)
                        txAddonRevenue += unitPrice * (qty as number)
                    })
                }
                totalAddonsRevenue += txAddonRevenue

                const feeBearer = event.fee_bearer || 'customer'
                // Ensure we pass organizer settings for effective rate resolution
                const effectiveRates = getEffectiveFeeRates(feeRates, event, event.organizers)

                // Calculate Discount for Subtotal
                const discount = tx.reservations?.discounts
                let discountAmount = 0
                if (discount) {
                    if (discount.type === 'percentage') {
                        discountAmount = (price * quantity) * (discount.value / 100)
                    } else {
                        discountAmount = discount.value
                    }
                }
                const subtotal = Math.max(0, (price * quantity) - discountAmount)

                // Note: tx.applied_fee_rate should be used if available to respect historical rates
                const appliedPlatformRate = tx.applied_fee_rate ?? effectiveRates.platformFeePercent
                const appliedProcessorRate = tx.applied_processor_rate ?? effectiveRates.processorFeePercent

                // Expected Fees = Ticket Revenue * PlatformRate + Total * ProcessorRate

                let usedPlatformRate = appliedPlatformRate
                // Fix Across: If stored rate is 0, use effective rate. 
                // If effective rate is ALSO 0 (unlikely for standard events), force 0.04 fallback for this repair.
                if (usedPlatformRate === 0) {
                    usedPlatformRate = effectiveRates.platformFeePercent > 0 ? effectiveRates.platformFeePercent : 0.04
                }

                const calcPlatformFee = subtotal * usedPlatformRate
                const calcProcessorFee = tx.amount * appliedProcessorRate

                let finalPlatformFee = tx.platform_fee
                if ((finalPlatformFee === 0 || finalPlatformFee === null || finalPlatformFee === undefined) && usedPlatformRate > 0 && subtotal > 0) {
                    finalPlatformFee = calcPlatformFee
                }

                let finalProcessorFee = tx.applied_processor_fee
                if ((finalProcessorFee === 0 || finalProcessorFee === null || finalProcessorFee === undefined) && appliedProcessorRate > 0 && tx.amount > 0) {
                    finalProcessorFee = calcProcessorFee
                } else if (finalProcessorFee === null || finalProcessorFee === undefined) {
                    finalProcessorFee = calcProcessorFee
                }

                const expectedTotalFees = finalPlatformFee + finalProcessorFee

                // Payout = Amount - Fees
                const netPayout = tx.amount - expectedTotalFees

                // Update totals
                // Note: We use the calculated values for display consistency
                totalPlatformFees += expectedTotalFees
                totalOrganizerNet += netPayout
            })

            setPayoutStats({
                totalCollected: totalVolume,
                platformFee: totalPlatformFees,
                organizerNet: totalOrganizerNet,
                transactionCount: statsRes.data.length,
                totalAddons: totalAddonsRevenue
            })

        } catch (e: any) {
            console.error('Payout fetch error:', e)
            toast.error('Failed to load payout data')
        } finally {
            setLoadingPayouts(false)
        }
    }

    // Refresh when page changes or event settings change (e.g. fee bearer toggled)
    useEffect(() => {
        if (activeTab === 'payouts') {
            fetchPayouts()
        }
    }, [payoutPage, activeTab, event.fee_bearer, event.platform_fee_percent])

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

    const tabClass = (tab: string) => clsx(
        "px-6 py-2.5 text-sm font-bold rounded-full transition-all duration-300 ease-out",
        activeTab === tab
            ? "bg-white dark:bg-white text-black dark:text-black shadow-md shadow-black/5 ring-1 ring-black/5"
            : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/10"
    )



    return (
        <div className="container mx-auto p-6 max-w-7xl font-sans">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-10">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    <Link href="/dashboard/events" className="hover:text-black dark:hover:text-white transition-colors">Events</Link>
                    <ArrowLeft className="w-3 h-3 rotate-180" />
                    <span className="text-black dark:text-white">{event.title}</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">{event.title}</h1>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium">
                            <span>{event.venue_name}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-700" />
                            <span suppressHydrationWarning>{new Date(event.starts_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link href={`/events/${event.slug || event.id}`} target="_blank">
                            <button className="h-10 px-5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 font-semibold text-sm hover:border-black dark:hover:border-white hover:bg-gray-50 dark:hover:bg-white/10 dark:text-white transition-all flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Page
                            </button>
                        </Link>
                        <button
                            onClick={() => updateEvent()}
                            disabled={loading}
                            className="h-10 px-6 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold hover:opacity-90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                        >
                            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex justify-start mb-10 overflow-x-auto pb-4 sm:pb-0 scrollbar-hide">
                <div className="inline-flex bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-full border border-gray-200/50 dark:border-white/5 relative">
                    <button onClick={() => setActiveTab('details')} className={tabClass('details')}>Overview</button>
                    <button onClick={() => setActiveTab('tickets')} className={tabClass('tickets')}>Tickets</button>
                    <button onClick={() => setActiveTab('attendees')} className={tabClass('attendees')}>Guest List</button>
                    {isAdmin && (
                        <button onClick={() => setActiveTab('discounts')} className={tabClass('discounts')}>Promotions</button>
                    )}
                    <button onClick={() => setActiveTab('team')} className={tabClass('team')}>Team</button>
                    <button onClick={() => setActiveTab('addons')} className={tabClass('addons')}>Add-ons</button>
                    {isAdmin && (
                        <button onClick={() => setActiveTab('payouts')} className={tabClass('payouts')}>Payouts</button>
                    )}
                </div>
            </div>


            {/* PAYOUTS TAB */}
            {activeTab === 'payouts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* ... Stats Cards (Keep existing ones, they are good) ... */}
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
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-white/10 border border-white/5 backdrop-blur-sm">
                                        <p className="text-sm text-gray-300 leading-relaxed font-medium">
                                            This is your net payout after fees. {event.fee_bearer === 'organizer' ? 'Fees are deducted from your earnings.' : 'Fees are paid by the customer.'}
                                        </p>
                                    </div>
                                    {activePayout ? (
                                        <div className="w-full bg-white/10 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border border-white/10 cursor-not-allowed">
                                            <div className="flex items-center gap-2 text-yellow-500">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Processing Payout</span>
                                            </div>
                                            <span className="text-xs font-normal text-gray-400">
                                                {formatCurrency(activePayout.amount, activePayout.currency)} requested on {new Date(activePayout.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleRequestPayout}
                                            disabled={requestingPayout || payoutStats.organizerNet <= 0}
                                            className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98] shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {requestingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Payout'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Card */}
                        <div className="bg-white dark:bg-[#111] p-10 rounded-[2rem] border border-gray-100 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-6">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-6">
                                <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-gray-400" />
                                    Financial Summary
                                </h3>
                                <div className="text-xs font-bold px-3 py-1 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 dark:text-gray-400">
                                    Real-time
                                </div>
                            </div>

                            <div className="space-y-5 flex-1">
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Gross Sales Volume</span>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg tabular-nums">{formatCurrency(payoutStats.totalCollected, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Total Transactions</span>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg tabular-nums">{payoutStats.transactionCount}</span>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-white/10 w-full" />
                                <div className="flex justify-between items-center group">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 dark:text-gray-400 font-medium group-hover:text-red-500 transition-colors">Platform Fees</span>
                                        <span className="text-[10px] text-gray-400 font-medium">GatePass + Processing</span>
                                    </div>
                                    <span className="font-bold text-red-500 text-lg tabular-nums">
                                        - {formatCurrency(payoutStats.platformFee, initialTiers?.[0]?.currency || 'GHS')}
                                    </span>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-white/10 w-full" />
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10">
                                    <span className="font-bold text-gray-900 dark:text-white">Net Earnings</span>
                                    <span className="font-black text-gray-900 dark:text-white text-xl tabular-nums tracking-tight">{formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Transaction History Table */}
                    <div className="bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                        <div className="px-8 py-8 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/10 flex items-center justify-center border border-gray-100 dark:border-white/10">
                                    <ScanLine className="w-5 h-5 text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-gray-900 dark:text-white">Recent Transactions</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{payoutCount} successful payments found</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const csv = generateCSV(transactions)
                                    downloadCSV(csv, `gatepass-transactions-${event.slug}`)
                                }}
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
                                    <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-white/10">
                                        <tr>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400">Customer</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Gross</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Fees</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Net Payout</th>
                                            <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                        {transactions.map((tx: any) => {
                                            const r = tx.reservations
                                            const tier = tiers.find(t => t.id === r?.tier_id)
                                            // Fallback to lookup on joined relation if tier not found in state
                                            const price = tier?.price ?? r?.ticket_tiers?.price ?? 0
                                            const quantity = r?.quantity || 1

                                            // Discount
                                            let discountAmount = 0
                                            const discount = r?.discounts
                                            if (discount) {
                                                if (discount.type === 'percentage') {
                                                    discountAmount = (price * quantity) * (discount.value / 100)
                                                } else {
                                                    discountAmount = discount.value
                                                }
                                            }

                                            // Calc Payout (Re-calc for display row)
                                            const subtotal = Math.max(0, (price * quantity) - discountAmount)

                                            // Calculate Addon Subtotal for this Row
                                            let addonSubtotal = 0
                                            if (r?.addons && typeof r.addons === 'object') {
                                                Object.entries(r.addons).forEach(([addonId, qty]) => {
                                                    const found = addons.find(a => a.id === addonId)
                                                    if (found) addonSubtotal += found.price * (qty as number)
                                                })
                                            }

                                            const feeBearer = event.fee_bearer || 'customer'
                                            // Ensure we pass organizer settings for effective rate resolution
                                            const effectiveRates = getEffectiveFeeRates(feeRates, event, event.organizers)
                                            const calculated = calculateFees(subtotal, addonSubtotal, feeBearer, effectiveRates)

                                            // Confirmed Logic: Payout = Amount - Fees

                                            const appliedPlatformRate = tx.applied_fee_rate ?? effectiveRates.platformFeePercent
                                            const appliedProcessorRate = tx.applied_processor_rate ?? effectiveRates.processorFeePercent

                                            let usedPlatformRate = appliedPlatformRate
                                            // Fix Across: If stored rate is 0, use effective rate. 
                                            // If effective rate is ALSO 0 (unlikely for standard events), force 0.04 fallback for this repair.
                                            if (usedPlatformRate === 0) {
                                                usedPlatformRate = effectiveRates.platformFeePercent > 0 ? effectiveRates.platformFeePercent : 0.04
                                            }

                                            const calcPlatformFee = subtotal * usedPlatformRate
                                            const calcProcessorFee = tx.amount * appliedProcessorRate

                                            let finalPlatformFee = tx.platform_fee
                                            // Aggressive Fix: If stored is 0 but calculated is > 0, assume stored is wrong/legacy and use calculated.
                                            if (!finalPlatformFee && calcPlatformFee > 0) {
                                                finalPlatformFee = calcPlatformFee
                                            }

                                            let finalProcessorFee = tx.applied_processor_fee
                                            if (!finalProcessorFee && calcProcessorFee > 0) {
                                                finalProcessorFee = calcProcessorFee
                                            }

                                            const totalFees = finalPlatformFee + finalProcessorFee
                                            const netPayout = tx.amount - totalFees

                                            return (
                                                <tr
                                                    key={tx.id}
                                                    onClick={() => setSelectedTransaction(tx)}
                                                    className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-8 py-5 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                                                        {new Date(tx.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                                                                {(r?.profiles?.full_name || r?.guest_name || '?')[0]}
                                                            </div>
                                                            <span className="font-bold text-gray-900 dark:text-white">{r?.profiles?.full_name || r?.guest_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(tx.amount, tx.currency)}
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-medium text-red-500">
                                                        {totalFees > 0 ? `- ${formatCurrency(totalFees, tx.currency)}` : '-'}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <span className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 px-2 py-1 rounded-md">
                                                            {formatCurrency(netPayout, tx.currency)}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <button className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-20 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-gray-50 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
                                    <ScanLine className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No transactions yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                                    When people buy tickets, their payments will appear here in real-time.
                                </p>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {payoutCount > 20 && (
                            <div className="px-8 py-4 bg-gray-50/30 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Showing <span className="font-medium">{payoutPage * 20 + 1}</span> to <span className="font-medium">{Math.min((payoutPage + 1) * 20, payoutCount)}</span> of <span className="font-medium">{payoutCount}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPayoutPage(p => Math.max(0, p - 1))}
                                        disabled={payoutPage === 0}
                                        className="px-4 py-2 bg-white dark:bg-[#111] dark:text-white border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPayoutPage(p => p + 1)}
                                        disabled={(payoutPage + 1) * 20 >= payoutCount}
                                        className="px-4 py-2 bg-white dark:bg-[#111] dark:text-white border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {/* LINEUP TAB */}
            {/* LINEUP TAB REMOVED - NOW EMBEDDED */}

            <TransactionDetailModal
                transaction={selectedTransaction}
                isOpen={!!selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
                eventFeeBearer={event.fee_bearer}
            />



            {/* DETAILS TAB */}
            {
                activeTab === 'details' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                        {/* 1. Stats Row */}
                        {/* 1. Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                            {/* Gross Revenue - Highlighted */}
                            <div className="col-span-2 md:col-span-1 xl:col-span-1 bg-black text-white dark:bg-white dark:text-black p-6 rounded-3xl shadow-xl shadow-black/5 flex flex-col justify-between relative overflow-hidden group min-h-[140px]">
                                <div className="absolute top-0 right-0 p-16 bg-white/10 dark:bg-black/5 rounded-full translate-x-8 -translate-y-8 blur-2xl transition-transform group-hover:scale-110 duration-700" />
                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div className="flex items-center gap-2 text-white/60 dark:text-black/60 mb-2">
                                        <div className="p-1.5 bg-white/10 dark:bg-black/5 rounded-lg">
                                            <DollarSign className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Gross Revenue</span>
                                    </div>
                                    <p className="text-2xl xl:text-3xl font-black tracking-tight mt-1">
                                        {formatCurrency(stats.totalRevenue, initialTiers?.[0]?.currency || 'GHS')}
                                    </p>
                                </div>
                            </div>

                            {/* Tickets Sold */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 transition-all group min-h-[140px] flex flex-col justify-between">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                                        <Ticket className="w-5 h-5" />
                                    </div>
                                    <span className={clsx("text-[10px] font-bold px-2 py-1 rounded-full",
                                        stats.utilization >= 90 ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                                            stats.utilization >= 50 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                                    )}>
                                        {stats.utilization.toFixed(0)}% Sold
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tickets Sold</p>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-xl font-black text-gray-900 dark:text-white">{stats.totalSold}</p>
                                        <span className="text-xs font-medium text-gray-400">/ {stats.totalCapacity}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Total Views */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 transition-all group min-h-[140px] flex flex-col justify-between">
                                <div className="mb-2 w-10 h-10 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Eye className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Views</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">{event.view_count?.toLocaleString() || 0}</p>
                                </div>
                            </div>

                            {/* Utilization/Capacity */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 transition-all group min-h-[140px] flex flex-col justify-between">
                                <div className="mb-2 w-10 h-10 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Utilization</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">{stats.utilization.toFixed(1)}%</p>
                                </div>
                            </div>

                            {/* Discounts */}
                            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 transition-all group min-h-[140px] flex flex-col justify-between">
                                <div className="mb-2 w-10 h-10 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                    <Ticket className="w-5 h-5 rotate-45" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Discounts</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(initialTotalDiscountValue, initialTiers?.[0]?.currency || 'GHS')}</p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Charts Row */}
                        {analyticsTickets.length > 0 && (
                            <AnalyticsCharts tickets={analyticsTickets} />
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* LEFT COLUMN (8 cols) */}
                            <div className="lg:col-span-8 space-y-8">

                                {/* General Info */}
                                <div className="p-8 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-6">
                                    <div className="flex items-center gap-3 border-b pb-4 border-gray-100 dark:border-white/10">
                                        <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
                                            <ImageIcon className="w-5 h-5 text-gray-900 dark:text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Event Identity</h3>
                                    </div>
                                    <div className="grid gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Event Title</label>
                                            <input
                                                disabled={isStaff}
                                                value={event.title}
                                                onChange={e => setEvent({ ...event, title: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-lg font-bold focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none text-gray-900 dark:text-white disabled:opacity-70"
                                                placeholder="E.g. Summer Music Festival"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                            <RichTextEditor
                                                value={event.description}
                                                onChange={(value) => setEvent({ ...event, description: value })}
                                                placeholder="Describe your event to attract attendees..."
                                                readOnly={isStaff}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Lineup Editor (Embedded) */}
                                <div className="p-8 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-6">
                                    <div className="flex items-center gap-3 border-b pb-4 border-gray-100 dark:border-white/10">
                                        <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
                                            <Users className="w-5 h-5 text-gray-900 dark:text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Event Lineup</h3>
                                    </div>
                                    <LineupTab
                                        lineup={event.lineup || []}
                                        onChange={(newLineup) => setEvent({ ...event, lineup: newLineup })}
                                        organizationId={event.organization_id || ''}
                                    />
                                </div>

                                {/* Timing & URL (Moved from Right) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Date & Time */}
                                    <div className="p-6 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-sm space-y-4">
                                        <div className="flex items-center gap-3 pb-2">
                                            <div className="p-1.5 bg-gray-50 dark:bg-white/5 rounded-lg">
                                                <Calendar className="w-4 h-4 text-gray-900 dark:text-white" />
                                            </div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Timing</h3>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Starts</label>
                                            <DateTimePicker
                                                date={event.starts_at ? new Date(event.starts_at) : undefined}
                                                setDate={(date) => setEvent({ ...event, starts_at: date ? date.toISOString() : '' })}
                                                disabled={isStaff}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Ends</label>
                                            <DateTimePicker
                                                date={event.ends_at ? new Date(event.ends_at) : undefined}
                                                setDate={(date) => setEvent({ ...event, ends_at: date ? date.toISOString() : undefined })}
                                                disabled={isStaff}
                                            />
                                        </div>
                                    </div>

                                    {/* URL Slug */}
                                    <div className="p-6 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-sm space-y-4">
                                        <div className="flex items-center gap-3 pb-2">
                                            <div className="p-1.5 bg-gray-50 dark:bg-white/5 rounded-lg">
                                                <Globe className="w-4 h-4 text-gray-900 dark:text-white" />
                                            </div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Custom URL</h3>
                                        </div>
                                        <div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400 mb-1">gatepass.com/events/</span>
                                                <div className="relative">
                                                    <input
                                                        disabled={isStaff}
                                                        value={event.slug}
                                                        onChange={e => setEvent({ ...event, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                                        className={`w-full bg-gray-50 dark:bg-white/5 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:border-transparent transition-all outline-none dark:text-white disabled:opacity-70 ${slugStatus === 'taken'
                                                                ? 'border-red-300 dark:border-red-500 focus:ring-red-200 dark:focus:ring-red-500/20'
                                                                : slugStatus === 'available'
                                                                    ? 'border-green-300 dark:border-green-500 focus:ring-green-200 dark:focus:ring-green-500/20'
                                                                    : 'border-gray-200 dark:border-white/10 focus:ring-black dark:focus:ring-white'
                                                            }`}
                                                        placeholder="my-event"
                                                    />
                                                    {slugStatus === 'checking' && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                        </div>
                                                    )}
                                                    {slugStatus === 'available' && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                {slugStatus === 'taken' && (
                                                    <p className="text-xs text-red-500 mt-1.5 font-medium">This URL slug is already taken.</p>
                                                )}
                                                {slugStatus === 'available' && event.slug !== originalSlug && (
                                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium">URL available!</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Settings (Super Admin Only) */}
                                {isSuperAdmin && (
                                    <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-fit">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                                                    <DollarSign className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                </div>
                                                Financial Settings
                                            </h3>
                                            <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border",
                                                feeSource === 'Event Specific' ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" :
                                                    feeSource === 'Organizer Default' ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" :
                                                        "bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10"
                                            )}>
                                                {feeSource}
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Platform Fee Override (%)</label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={feeInput}
                                                        onChange={(e) => setFeeInput(e.target.value)}
                                                        placeholder="Default"
                                                        className="h-11"
                                                        type="number"
                                                    />
                                                    <Button
                                                        type="button"
                                                        onClick={handleSaveFee}
                                                        disabled={feeSaving}
                                                        className="h-11 px-6 font-bold"
                                                    >
                                                        {feeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                                    </Button>
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                                                    Current Effective Rate: <span className="font-bold text-gray-900 dark:text-white">{(getEffectiveFeeRates(feeRates, event).platformFeePercent * 100).toFixed(2)}%</span>.
                                                    Leave empty to inherit from Organizer or System default.
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 dark:border-white/10">
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Fee Bearer (Who pays?)</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBearer = 'customer';
                                                            setEvent({ ...event, fee_bearer: newBearer }); // Optimistic
                                                            updateEventFeeBearer(event.id, newBearer).then(() => toast.success('Fee bearer updated')).catch(e => toast.error(e.message));
                                                        }}
                                                        className={clsx(
                                                            "px-4 py-3 rounded-xl text-sm font-bold border transition-all text-left flex flex-col gap-1",
                                                            event.fee_bearer === 'customer'
                                                                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white ring-2 ring-offset-2 ring-black/10 dark:ring-white/10"
                                                                : "bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10 hover:border-gray-300"
                                                        )}
                                                    >
                                                        <span>Customer</span>
                                                        <span className="text-[10px] opacity-70 font-normal">Fees added to total</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBearer = 'organizer';
                                                            setEvent({ ...event, fee_bearer: newBearer }); // Optimistic
                                                            updateEventFeeBearer(event.id, newBearer).then(() => toast.success('Fee bearer updated')).catch(e => toast.error(e.message));
                                                        }}
                                                        className={clsx(
                                                            "px-4 py-3 rounded-xl text-sm font-bold border transition-all text-left flex flex-col gap-1",
                                                            event.fee_bearer === 'organizer'
                                                                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white ring-2 ring-offset-2 ring-black/10 dark:ring-white/10"
                                                                : "bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10 hover:border-gray-300"
                                                        )}
                                                    >
                                                        <span>Organizer</span>
                                                        <span className="text-[10px] opacity-70 font-normal">Fees deducted from payout</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Poster Image */}
                                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-fit">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                            <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        Event Poster
                                    </h3>
                                    <div className="space-y-4">
                                        <MediaUploader
                                            type="image"
                                            path={`${event.organization_id}/${event.id}`}
                                            value={event.poster_url || ''}
                                            onChange={(url) => setEvent({ ...event, poster_url: url })}
                                            disabled={isStaff}
                                        />
                                        <p className="text-xs text-gray-500 text-center px-4">
                                            Recommended: 1080x1350px (4:5) or 1080x1920px (9:16). Max 5MB.
                                        </p>
                                    </div>
                                </div>


                                {/* Event Logo */}
                                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-fit">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center">
                                            <ImageIcon className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        </div>
                                        Event Logo
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-center">
                                            <div className="w-32">
                                                <MediaUploader
                                                    type="image"
                                                    path={`${event.organization_id}/${event.id}`}
                                                    value={event.logo_url || ''}
                                                    onChange={(url) => setEvent({ ...event, logo_url: url })}
                                                    className="!rounded-full"
                                                    aspectRatio="square"
                                                    disabled={isStaff}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 text-center px-4">
                                            Displayed on ticket cards. Square image recommended.
                                        </p>
                                    </div>
                                </div>




                                {/* Event Video */}
                                <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-fit">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                                            <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        Event Video
                                    </h3>
                                    <div className="space-y-4">
                                        <MediaUploader
                                            type="video"
                                            path={`${event.organization_id}/${event.id}`}
                                            value={event.video_url || ''}
                                            onChange={(url) => setEvent({ ...event, video_url: url })}
                                        />
                                        <p className="text-xs text-gray-500 text-center px-4">
                                            Short teaser video (15-30s). Max 50MB. Will be auto-optimized to WebM.
                                        </p>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="p-8 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-6">
                                    <div className="flex items-center gap-3 border-b pb-4 border-gray-100 dark:border-white/10">
                                        <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
                                            <MapPin className="w-5 h-5 text-gray-900 dark:text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Location</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Venue Name</label>
                                                <input
                                                    disabled={isStaff}
                                                    value={event.venue_name || ''}
                                                    onChange={e => setEvent({ ...event, venue_name: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none dark:text-white disabled:opacity-70"
                                                    placeholder="Venue Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Venue Address</label>
                                                <input
                                                    disabled={isStaff}
                                                    value={event.venue_address || ''}
                                                    onChange={e => setEvent({ ...event, venue_address: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-semibold focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none dark:text-white disabled:opacity-70"
                                                    placeholder="Physical Address"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 bg-gray-50/50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 border-dashed">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Latitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={event.latitude || ''}
                                                    onChange={e => setEvent({ ...event, latitude: parseFloat(e.target.value) })}
                                                    className="w-full bg-white dark:bg-transparent border-gray-200 dark:border-white/10 rounded-lg p-2 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none font-mono text-gray-900 dark:text-white"
                                                    placeholder="5.6037"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Longitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={event.longitude || ''}
                                                    onChange={e => setEvent({ ...event, longitude: parseFloat(e.target.value) })}
                                                    className="w-full bg-white dark:bg-transparent border-gray-200 dark:border-white/10 rounded-lg p-2 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none font-mono text-gray-900 dark:text-white"
                                                    placeholder="-0.1870"
                                                />
                                            </div>
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
                                                onChange={e => {
                                                    if (e.target.checked && tiers.length === 0) {
                                                        toast.error('You must create at least one ticket tier before publishing.')
                                                        return
                                                    }
                                                    setEvent({ ...event, is_published: e.target.checked })
                                                }}
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

                                {/* Branding (Moved from Left) */}
                                <div className="p-8 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-[0_2px_40px_rgba(0,0,0,0.04)] space-y-8">
                                    <div className="flex items-center gap-3 border-b pb-4 border-gray-100 dark:border-white/10">
                                        <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
                                            <div className="w-5 h-5 rounded-full border border-gray-200 dark:border-white/20 shadow-sm" style={{ background: event.primary_color || '#000000' }} />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Event Branding</h3>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Presets */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Curated Palette</label>
                                            <div className="flex flex-wrap gap-3">
                                                {[
                                                    { color: '#000000', name: 'Pitch Black' },
                                                    { color: '#18181B', name: 'Charcoal' },
                                                    { color: '#2563EB', name: 'Royal Blue' },
                                                    { color: '#7C3AED', name: 'Electric Purple' },
                                                    { color: '#DB2777', name: 'Hot Pink' },
                                                    { color: '#DC2626', name: 'Crimson' },
                                                    { color: '#EA580C', name: 'Sunset' },
                                                    { color: '#059669', name: 'Emerald' },
                                                ].map((preset) => (
                                                    <button
                                                        key={preset.color}
                                                        type="button"
                                                        onClick={() => setEvent({ ...event, primary_color: preset.color })}
                                                        className={clsx(
                                                            "w-10 h-10 rounded-full border-2 transition-all hover:scale-110 shadow-sm",
                                                            event.primary_color === preset.color ? "border-black dark:border-white scale-110 ring-2 ring-offset-2 ring-black/10 dark:ring-white/10" : "border-transparent hover:border-gray-200 dark:hover:border-white/20"
                                                        )}
                                                        style={{ background: preset.color }}
                                                        title={preset.name}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Input */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Custom Hex Code</label>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <input
                                                        type="color"
                                                        value={event.primary_color || '#000000'}
                                                        onChange={e => setEvent({ ...event, primary_color: e.target.value })}
                                                        className="w-12 h-12 rounded-xl cursor-pointer bg-white border border-gray-200 p-1 opacity-0 absolute inset-0 z-10"
                                                    />
                                                    <div className="w-12 h-12 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center p-1" style={{ background: event.primary_color || '#000000' }}>
                                                        <div className="w-full h-full rounded-lg border border-white/20" />
                                                    </div>
                                                </div>
                                                <div className="relative flex-1">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">#</span>
                                                    <input
                                                        value={event.primary_color?.replace('#', '') || ''}
                                                        onChange={e => setEvent({ ...event, primary_color: `#${e.target.value}` })}
                                                        type="text"
                                                        maxLength={6}
                                                        placeholder="000000"
                                                        className="w-full px-4 py-3 pl-8 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none font-bold uppercase text-gray-900 dark:text-white tracking-wider"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Live Preview */}
                                        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 border border-gray-100 dark:border-white/10">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">Live Preview</p>
                                            <div className="bg-white dark:bg-[#111] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-white/10 max-w-[240px] mx-auto">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10" />
                                                    <div className="space-y-1">
                                                        <div className="w-20 h-2 bg-gray-100 dark:bg-white/10 rounded-full" />
                                                        <div className="w-12 h-2 bg-gray-50 dark:bg-white/5 rounded-full" />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="w-full h-9 rounded-lg text-[10px] font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
                                                    style={{ background: event.primary_color || '#000000' }}
                                                >
                                                    <Ticket className="w-3 h-3" />
                                                    Get Tickets
                                                </button>
                                            </div>
                                            <p className="text-center text-xs text-gray-400 mt-4">
                                                This color defines your event's primary buttons and accents.
                                            </p>
                                        </div>
                                    </div>
                                </div>


                                {/* Financials */}
                                <div className="p-6 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-sm space-y-4">
                                    <div className="flex items-center gap-3 pb-2">
                                        <div className="p-1.5 bg-gray-50 dark:bg-white/5 rounded-lg">
                                            <DollarSign className="w-4 h-4 text-gray-900 dark:text-white" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">Financials</h3>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Fee Bearer</label>
                                        <select
                                            disabled={isStaff}
                                            value={event.fee_bearer || 'customer'}
                                            onChange={async (e) => {
                                                const newBearer = e.target.value as 'customer' | 'organizer'
                                                // Optimistic update
                                                setEvent({ ...event, fee_bearer: newBearer })
                                                try {
                                                    await updateEventFeeBearer(event.id, newBearer)
                                                    toast.success('Fee setting updated')
                                                } catch (err: any) {
                                                    toast.error('Failed to update: ' + err.message)
                                                }
                                            }}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-sm focus:ring-black dark:focus:ring-white focus:border-black transition-all text-gray-900 dark:text-white disabled:opacity-70"
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
                                <div className="p-6 rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shadow-sm space-y-4">
                                    <div className="flex items-center gap-3 pb-2">
                                        <div className="p-1.5 bg-gray-50 dark:bg-white/5 rounded-lg">
                                            <Share2 className="w-4 h-4 text-gray-900 dark:text-white" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">Socials</h3>
                                    </div>
                                    <div className="grid gap-3">
                                        <input
                                            disabled={isStaff}
                                            value={event.social_website || ''}
                                            onChange={e => setEvent({ ...event, social_website: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:ring-black dark:focus:ring-white focus:border-black transition-all text-gray-900 dark:text-white disabled:opacity-70"
                                            placeholder="Website URL"
                                        />
                                        <input
                                            disabled={isStaff}
                                            value={event.social_instagram || ''}
                                            onChange={e => setEvent({ ...event, social_instagram: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:ring-black dark:focus:ring-white focus:border-black transition-all text-gray-900 dark:text-white disabled:opacity-70"
                                            placeholder="Instagram Username"
                                        />
                                        <input
                                            disabled={isStaff}
                                            value={event.social_twitter || ''}
                                            onChange={e => setEvent({ ...event, social_twitter: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:ring-black dark:focus:ring-white focus:border-black transition-all text-gray-900 dark:text-white disabled:opacity-70"
                                            placeholder="X (Twitter)"
                                        />
                                    </div>
                                </div>

                                {/* Save Action - Sticky at bottom of column */}
                                <div className="sticky bottom-6 pt-4">
                                    {!isStaff ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => updateEvent()}
                                                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50 shadow-xl shadow-black/10 dark:shadow-white/5 hover:shadow-2xl hover:-translate-y-1 text-lg"
                                                disabled={loading}
                                            >
                                                {loading ? 'Saving Update...' : 'Save Changes'}
                                            </button>
                                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white/10">
                                                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/20 shadow-sm">
                                                    <h3 className="text-red-900 dark:text-red-200 font-bold mb-2">Danger Zone</h3>
                                                    <p className="text-red-700 dark:text-red-400 text-xs mb-4 leading-relaxed">
                                                        Deleting this event will permanently remove all associated data, including ticket sales and guest lists.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDeleteModalOpen(true)}
                                                        className="w-full bg-white dark:bg-white/5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-bold py-3 rounded-xl hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white hover:border-transparent transition-all shadow-sm"
                                                    >
                                                        Delete Event
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="bg-blue-50 dark:bg-blue-500/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-500/20 shadow-sm">
                                            <h3 className="text-blue-900 dark:text-blue-200 font-bold mb-1 flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4" />
                                                View Only Mode
                                            </h3>
                                            <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed font-medium">
                                                You are viewing this event as a Staff member. Only Owners and Admins can modify event details or delete events.
                                            </p>
                                        </div>
                                    )}
                                    <DeleteEventModal
                                        isOpen={isDeleteModalOpen}
                                        onClose={() => setIsDeleteModalOpen(false)}
                                        onConfirm={async () => {
                                            setIsDeleting(true)
                                            try {
                                                const { error } = await supabase.schema('gatepass').from('events').delete().eq('id', event.id)
                                                if (error) throw error
                                                toast.success('Event deleted successfully')
                                                router.push('/dashboard/events')
                                            } catch (e: any) {
                                                toast.error(e.message)
                                                setIsDeleting(false)
                                            }
                                        }}
                                        eventName={event.title}
                                        isDeleting={isDeleting}
                                    />
                                </div>

                            </div>
                        </div>
                    </div >
                )
            }

            {/* TICKETS TAB */}
            {
                activeTab === 'tickets' && (
                    <TicketsTab event={event} tiers={tiers} onTiersUpdate={setTiers} />
                )
            }

            {/* ADD-ONS TAB */}
            {activeTab === 'addons' && (
                <AddonsTab
                    addons={addons}
                    eventId={event.id}
                    organizationId={event.organization_id || ''}
                    onUpdate={refreshAddons}
                />
            )}


            {/* ATTENDEES TAB */}
            {
                activeTab === 'attendees' && (
                    <AttendeesTab event={event} isStaff={isStaff} />
                )
            }

            {/* DISCOUNTS TAB */}
            {
                activeTab === 'discounts' && (
                    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-gray-900 dark:text-white">{editingDiscountId ? 'Edit Discount Code' : 'Create Discount Code'}</h3>
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
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Code</label>
                                    <input
                                        required
                                        value={discountForm.code}
                                        onChange={e => setDiscountForm({ ...discountForm, code: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all uppercase font-medium text-gray-900 dark:text-white"
                                        placeholder="e.g. EARLYBIRD"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Type</label>
                                    <div className="relative">
                                        <select
                                            value={discountForm.type}
                                            onChange={e => setDiscountForm({ ...discountForm, type: e.target.value as 'percentage' | 'fixed' })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-medium appearance-none text-gray-900 dark:text-white"
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
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Value</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={isNaN(discountForm.value) ? '' : discountForm.value}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value)
                                            setDiscountForm({ ...discountForm, value: isNaN(val) ? 0 : val })
                                        }}
                                        className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-medium text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Total Usage Limit</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={discountForm.max_uses}
                                        onChange={e => setDiscountForm({ ...discountForm, max_uses: parseInt(e.target.value) })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-medium text-gray-900 dark:text-white"
                                        placeholder="∞"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Applies To</label>
                                    <div className="relative">
                                        <select
                                            value={discountForm.tier_id || ''}
                                            onChange={e => setDiscountForm({ ...discountForm, tier_id: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-medium appearance-none truncate pr-8 text-gray-900 dark:text-white"
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
                                        className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 shadow-lg shadow-black/20 hover:-translate-y-0.5 transition-all"
                                    >
                                        {creatingDiscount ? 'Saving...' : (editingDiscountId ? 'Update Discount' : 'Create Discount')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="grid gap-4">
                            {discounts.map(discount => (
                                <div key={discount.id} className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 flex items-center justify-between hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center font-bold text-xl border border-green-100 dark:border-green-500/10">
                                            %
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">{discount.code}</h4>
                                                <button
                                                    onClick={() => copyCode(discount.code, discount.id)}
                                                    className="text-gray-400 hover:text-black transition-colors p-1"
                                                    title="Copy Code"
                                                >
                                                    {copiedId === discount.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="text-sm font-medium text-gray-500 mt-1">
                                                {discount.type === 'percentage' ? `${discount.value}% OFF` : `-${formatCurrency(discount.value, event.currency || 'GHS')}`}
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
                                            className="text-gray-400 hover:text-black dark:hover:text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => deleteDiscount(discount.id)}
                                            className="text-gray-400 hover:text-red-600 font-bold text-sm px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {discounts.length === 0 && (
                                <div className="text-center py-24 text-gray-400 bg-white dark:bg-[#111] rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-500">
                                        <span className="font-bold text-2xl">%</span>
                                    </div>
                                    <p className="font-medium">No discount codes created yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }



            {/* TEAM TAB */}
            {
                activeTab === 'team' && (
                    <StaffTab eventId={event.id} isStaff={isStaff} />
                )
            }
        </div >
    )
}
