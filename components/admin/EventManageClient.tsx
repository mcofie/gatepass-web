'use client'

import React, { useState, useEffect } from 'react'
import { EventPaymentProvider } from '@/components/admin/EventPaymentProvider'
import { EventBillingCard } from '@/components/admin/EventBillingCard'
import type { IntegrationSummary } from '@/app/actions/integrations'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Calendar, MapPin, Ticket, ScanLine, Check, Eye, Download, ShieldCheck, Loader2, CopyPlus } from 'lucide-react'
import { Event, TicketTier } from '@/types/gatepass'
import { FormsTab } from '@/components/admin/tabs/FormsTab'
import { PromotionsTab } from '@/components/admin/tabs/PromotionsTab'
import { EventSectionNav } from '@/components/admin/EventSectionNav'
import clsx from 'clsx'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'
import { calculateFees, FeeRates, getEffectiveFeeRates } from '@/utils/fees'
import dynamic from 'next/dynamic'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import { logActivity } from '@/app/actions/logger'
import { duplicateEvent } from '@/app/actions/events'
import { Input } from '@/components/ui/Input'
import { Field, Notice, Panel, PrimaryButton, Switch, inputClass } from '@/components/dashboard/ui'
import { Button } from '@/components/ui/Button'

const DateTimePicker = dynamic(() => import('@/components/common/DateTimePicker').then(mod => mod.DateTimePicker), { ssr: false })
const AnalyticsCharts = dynamic(() => import('@/components/admin/AnalyticsCharts'), {
    loading: () => <div className="h-[300px] w-full bg-gray-50/50 rounded-2xl animate-pulse" />,
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
import { WidgetsTab } from '@/components/admin/tabs/WidgetsTab'
import { InstalmentsTab } from '@/components/admin/tabs/InstalmentsTab'


const EVENT_COLORS = [
    { color: '#000000', name: 'Black' },
    { color: '#18181B', name: 'Charcoal' },
    { color: '#2563EB', name: 'Blue' },
    { color: '#7C3AED', name: 'Purple' },
    { color: '#DB2777', name: 'Pink' },
    { color: '#DC2626', name: 'Red' },
    { color: '#EA580C', name: 'Orange' },
    { color: '#059669', name: 'Green' },
]

/** ISO timestamp → value for a datetime-local input, in the viewer's time zone. */
function toLocalInputValue(iso: string) {
    const date = new Date(iso)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function OverviewSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-4">
            <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">
                <span className="text-sm font-semibold tabular-nums text-gray-400">{number}</span>
                {title}
            </h2>
            {children}
        </section>
    )
}

const EVENT_TABS = ['details', 'tickets', 'attendees', 'discounts', 'sales', 'team', 'lineup', 'addons', 'widgets', 'instalments', 'forms'] as const
type EventTab = typeof EVENT_TABS[number]

/** Same rules as the events list: ended beats published, scheduled beats draft. */
function eventStatus(event: { is_published: boolean; starts_at: string; ends_at?: string | null; publish_at?: string | null }) {
    const end = event.ends_at || event.starts_at
    if (end && new Date(end).getTime() < Date.now()) return { label: 'Ended', dot: 'bg-gray-400' }
    if (event.is_published) return { label: 'On sale', dot: 'bg-emerald-500' }
    if (event.publish_at) return { label: 'Scheduled', dot: 'bg-sky-500' }
    return { label: 'Draft', dot: 'bg-gray-300 dark:bg-white/30' }
}

interface EventManageClientProps {
    event: Event
    initialTiers: TicketTier[]
    initialTotalRevenue?: number
    initialTotalDiscountValue?: number
    userRole: string
    feeRates?: FeeRates
    isSuperAdmin?: boolean
    paymentIntegrations?: IntegrationSummary[]
}

export function EventManageClient({
    event: initialEvent,
    initialTiers,
    initialTotalRevenue = 0,
    initialTotalDiscountValue = 0,
    userRole,
    feeRates,
    isSuperAdmin = false,
    paymentIntegrations = []
}: EventManageClientProps) {
    const isStaff = userRole === 'Staff'
    const isAdmin = userRole === 'Owner' || userRole === 'Admin' || isSuperAdmin
    const [event, setEvent] = useState(initialEvent)
    const supabase = createClient()
    const searchParams = useSearchParams()
    const [activeTab, setActiveTabState] = useState<EventTab>(() => {
        const requested = searchParams.get('tab')
        return (EVENT_TABS as readonly string[]).includes(requested ?? '') ? requested as EventTab : 'details'
    })
    // Deep-linkable sections: /dashboard/events/:id?tab=tickets
    const setActiveTab = (tab: EventTab) => {
        setActiveTabState(tab)
        const url = new URL(window.location.href)
        if (tab === 'details') url.searchParams.delete('tab')
        else url.searchParams.set('tab', tab)
        url.searchParams.delete('billing')
        window.history.replaceState(null, '', url)
    }
    const [loading, setLoading] = useState(false)
    const [addons, setAddons] = useState<any[]>([])

    // Tickets State
    const [tiers, setTiers] = useState<TicketTier[]>(initialTiers) // Kept initialTiers from props




    // Sales State
    const [salesStats, setSalesStats] = useState({ totalCollected: 0, transactionCount: 0, totalAddons: 0 })
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingSales, setLoadingSales] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
    const [salesPage, setSalesPage] = useState(0)
    const [salesCount, setSalesCount] = useState(0)

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState(false)

    // Slug Validation State
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
    const [originalSlug] = useState(initialEvent.slug) // Track original slug to skip validation if unchanged

    // Fetch data on load
    useEffect(() => {
        const fetchDeepData = async () => {

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
        const { data: addonsData } = await supabase
            .schema('gatepass')
            .from('event_addons')
            .select('*')
            .eq('event_id', event.id)
            .order('price', { ascending: true })
        if (addonsData) setAddons(addonsData)
    }

    const router = useRouter()

    // Stats Calculation
    const eventCurrency = (event.currency || tiers[0]?.currency || 'GHS').toUpperCase()
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

            if (event.starts_at && event.starts_at !== initialEvent.starts_at && new Date(event.starts_at).getTime() < Date.now()) {
                throw new Error('The start time is in the past.')
            }
            if (event.ends_at && event.starts_at && new Date(event.ends_at) <= new Date(event.starts_at)) {
                throw new Error('The event has to end after it starts.')
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
                video_url_portrait: event.video_url_portrait || null,
                logo_url: event.logo_url,
                is_published: event.is_published,
                fee_bearer: event.fee_bearer,
                platform_fee_percent: event.platform_fee_percent,
                primary_color: event.primary_color,
                lineup: event.lineup,
                publish_at: event.publish_at || null,
                sales_enabled: event.sales_enabled ?? true
            }).eq('id', event.id)

            if (error) throw error

            // Log Activity
            await logActivity(event.organization_id || '', 'update_event', 'event', event.id, { title: event.title })

            toast.success('Event updated successfully')
            router.refresh()
        } catch (e: any) {
            // Publishing was blocked by the database (unpaid plan or no payment provider)
            if (typeof e?.hint === 'string' && /^(PLATFORM_FEE|PAYMENT_PROVIDER)/.test(e.hint)) {
                setEvent(prev => ({ ...prev, is_published: false }))
                toast.error(e.message)
                return
            }
            toast.error('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    // ... (rest of code)

    // Sales: paginated transactions plus totals across every successful payment
    const fetchSales = async () => {
        setLoadingSales(true)
        try {
            const statsQuery = supabase
                .schema('gatepass')
                .from('transactions')
                .select('amount, reservations!inner ( addons )')
                .eq('status', 'success')
                .eq('reservations.event_id', event.id)

            const PAGE_SIZE = 20
            const from = salesPage * PAGE_SIZE
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
                        ticket_tiers ( price, min_quantity, discount_value, discount_type ),
                        addons
                    )
                `, { count: 'exact' })
                .eq('status', 'success')
                .eq('reservations.event_id', event.id)
                .order('created_at', { ascending: false })
                .range(from, to)

            const [statsRes, listRes] = await Promise.all([statsQuery, listQuery])
            if (statsRes.error) throw statsRes.error
            if (listRes.error) throw listRes.error

            setTransactions(listRes.data || [])
            setSalesCount(listRes.count || 0)

            const addonPrice = (id: string) => addons.find(a => a.id === id)?.price || 0
            let totalCollected = 0
            let totalAddons = 0
            statsRes.data.forEach((tx: any) => {
                totalCollected += tx.amount || 0
                const resAddons = tx.reservations?.addons
                if (resAddons && typeof resAddons === 'object') {
                    Object.entries(resAddons).forEach(([addonId, qty]) => { totalAddons += addonPrice(addonId) * (qty as number) })
                }
            })

            setSalesStats({ totalCollected, transactionCount: statsRes.data.length, totalAddons })
        } catch (e: any) {
            console.error('Sales fetch error:', e)
            toast.error('Failed to load sales')
        } finally {
            setLoadingSales(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'sales') {
            fetchSales()
        }
    }, [salesPage, activeTab])

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







    return (
        <div className="mx-auto max-w-[1180px] space-y-7 pb-16 font-sans">
            {/* Header */}
            <div className="space-y-6">
                <Link href="/dashboard/events" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-950 dark:text-gray-400 dark:hover:text-white">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Events
                </Link>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex min-w-0 items-center gap-5">
                        <div className="relative hidden h-24 w-[76px] shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5 sm:block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {event.poster_url && <img src={event.poster_url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                            {(() => {
                                const status = eventStatus(event)
                                return (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:border-white/10 dark:text-gray-300">
                                        <span className={clsx('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
                                        {status.label}
                                    </span>
                                )
                            })()}
                            <h1 className="mt-3 truncate text-[30px] font-semibold leading-tight tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[40px]">{event.title}</h1>
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400" suppressHydrationWarning>
                                <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" aria-hidden="true" />{new Date(event.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                {event.venue_name && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{event.venue_name}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link href={`/events/${event.slug || event.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                            Event page <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                        {!isStaff && (
                            <button
                                onClick={async () => {
                                    setIsDuplicating(true)
                                    try {
                                        const result = await duplicateEvent(event.id)
                                        if (result.error) {
                                            toast.error(result.error)
                                        } else {
                                            toast.success('Event duplicated')
                                            router.push(`/dashboard/events/${result.eventId}`)
                                        }
                                    } catch (e: any) {
                                        toast.error('Failed to duplicate: ' + e.message)
                                    } finally {
                                        setIsDuplicating(false)
                                    }
                                }}
                                disabled={isDuplicating}
                                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                            >
                                {isDuplicating ? <Loader2 className="size-4 animate-spin" /> : <CopyPlus className="size-4" aria-hidden="true" />}
                                Duplicate
                            </button>
                        )}
                        {activeTab === 'details' && !isStaff && (
                            <button
                                onClick={() => updateEvent()}
                                disabled={loading}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gray-950 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
                            >
                                {loading && <Loader2 className="size-4 animate-spin" />}
                                {loading ? 'Saving…' : 'Save changes'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <EventSectionNav active={activeTab} onChange={setActiveTab} isAdmin={isAdmin} />


            {/* PAYOUTS TAB */}
            {activeTab === 'sales' && (
                <div className="space-y-6 animate-in fade-in duration-200" aria-busy={loadingSales}>
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Sales</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ticket payments go straight to your connected payment provider.</p>
                    </div>

                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[
                            { label: 'Gross sales', value: formatCurrency(salesStats.totalCollected, initialTiers?.[0]?.currency || 'GHS') },
                            { label: 'Transactions', value: salesStats.transactionCount.toLocaleString() },
                            { label: 'Add-ons', value: formatCurrency(salesStats.totalAddons, initialTiers?.[0]?.currency || 'GHS') },
                        ].map(stat => (
                            <div key={stat.label} className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</dt>
                                <dd className="mt-3 truncate text-3xl font-semibold tabular-nums tracking-tight text-gray-950 dark:text-white">
                                    {loadingSales ? '…' : stat.value}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    {/* Transaction History Table */}
                    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/10 flex items-center justify-center border border-gray-100 dark:border-white/10">
                                    <ScanLine className="w-5 h-5 text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Recent transactions</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{salesCount} successful payments found</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const csv = generateCSV(transactions)
                                    downloadCSV(csv, `gatepass-transactions-${event.slug}`)
                                }}
                                disabled={transactions.length === 0}
                                className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400 disabled:pointer-events-none disabled:opacity-40 dark:border-white/10 dark:bg-[#111] dark:text-white sm:self-auto"
                            >
                                <Download className="w-4 h-4" />
                                Export page
                            </button>
                        </div>

                        {transactions.length > 0 ? (
                            <div className="md:overflow-x-auto">
                                <table className="block w-full text-left text-sm md:table">
                                    <thead className="hidden border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 md:table-header-group">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Date</th>
                                            <th className="px-5 py-3 font-medium">Customer</th>
                                            <th className="px-5 py-3 text-right font-medium">Gross</th>
                                            <th className="px-5 py-3 text-right font-medium">Fees</th>
                                            <th className="px-5 py-3 text-right font-medium">Net</th>
                                            <th className="px-5 py-3 text-center font-medium">View</th>
                                        </tr>
                                    </thead>
                                    <tbody className="block space-y-2 p-4 md:table-row-group md:divide-y md:divide-gray-50 md:space-y-0 md:p-0 dark:md:divide-white/5">
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
                                            // Normalize old 2% rate to current 1.95%
                                            const storedProcessorRate2 = tx.applied_processor_rate
                                            const appliedProcessorRate = (storedProcessorRate2 === 0.02 || storedProcessorRate2 == null)
                                                ? effectiveRates.processorFeePercent
                                                : storedProcessorRate2

                                            // A stored 0 means no per-ticket fee was charged (bring-your-own-keys era)
                                            const usedPlatformRate = appliedPlatformRate

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
                                                    className="group block cursor-pointer rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50/50 dark:border-white/10 dark:hover:bg-white/5 md:table-row md:rounded-none md:border-0 md:p-0"
                                                >
                                                    <td className="block pb-2 text-xs text-gray-500 dark:text-gray-400 md:table-cell md:whitespace-nowrap md:px-5 md:py-4 md:text-sm">
                                                        {new Date(tx.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="block pb-3 md:table-cell md:px-5 md:py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-white/10 dark:text-gray-400">
                                                                {(r?.profiles?.full_name || r?.guest_name || '?')[0]}
                                                            </div>
                                                            <span className="font-medium text-gray-900 dark:text-white">{r?.profiles?.full_name || r?.guest_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="flex items-center justify-between gap-3 border-t border-gray-100 py-2 text-right font-medium text-gray-900 dark:border-white/10 dark:text-white md:table-cell md:border-0 md:px-5 md:py-4">
                                                        <span className="font-normal text-gray-500 md:hidden">Gross</span><span>{formatCurrency(tx.amount, tx.currency)}</span>
                                                    </td>
                                                    <td className="flex items-center justify-between gap-3 py-2 text-right text-gray-600 dark:text-gray-400 md:table-cell md:px-5 md:py-4">
                                                        <span className="md:hidden">Fees</span><span>{totalFees > 0 ? `- ${formatCurrency(totalFees, tx.currency)}` : '-'}</span>
                                                    </td>
                                                    <td className="flex items-center justify-between gap-3 py-2 text-right md:table-cell md:px-5 md:py-4">
                                                        <span className="text-gray-500 md:hidden">Net</span>
                                                        <span className="font-semibold tabular-nums text-gray-950 dark:text-white">
                                                            {formatCurrency(netPayout, tx.currency)}
                                                        </span>
                                                    </td>
                                                    <td className="block pt-2 text-center md:table-cell md:px-5 md:py-4">
                                                        <button type="button" onClick={() => setSelectedTransaction(tx)} aria-label={`View transaction for ${r?.profiles?.full_name || r?.guest_name || 'guest'}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 md:w-auto md:border-0 md:p-2">
                                                            <Eye className="h-4 w-4" /><span className="md:hidden">View details</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-5 py-14 text-center">
                                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">No transactions yet</h3>
                                <p className="mx-auto max-w-xs text-sm text-gray-500 dark:text-gray-400">
                                    Ticket payments will appear here.
                                </p>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {salesCount > 20 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/30 px-5 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Showing <span className="font-medium">{salesPage * 20 + 1}</span> to <span className="font-medium">{Math.min((salesPage + 1) * 20, salesCount)}</span> of <span className="font-medium">{salesCount}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSalesPage(p => Math.max(0, p - 1))}
                                        disabled={salesPage === 0}
                                        className="px-4 py-2 bg-white dark:bg-[#111] dark:text-white border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setSalesPage(p => p + 1)}
                                        disabled={(salesPage + 1) * 20 >= salesCount}
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

            {/* INSTALMENTS TAB */}
            {activeTab === 'instalments' && (
                <InstalmentsTab event={event} />
            )}

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
                    <div className="space-y-10 animate-in fade-in duration-200">
                        {/* Key numbers */}
                        <section aria-label="Event performance" className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                            <div className="grid grid-cols-2 md:grid-cols-4">
                                {[
                                    { label: 'Revenue', value: formatCurrency(stats.totalRevenue, eventCurrency), detail: initialTotalDiscountValue > 0 ? `${formatCurrency(initialTotalDiscountValue, eventCurrency)} in discounts` : 'Paid orders' },
                                    { label: 'Tickets sold', value: stats.totalSold.toLocaleString(), detail: `of ${stats.totalCapacity.toLocaleString()}` },
                                    { label: 'Capacity filled', value: `${Math.round(stats.utilization)}%`, detail: 'All ticket types', bar: stats.utilization },
                                    { label: 'Page views', value: (event.view_count || 0).toLocaleString(), detail: 'Event page' },
                                ].map((metric, index) => (
                                    <div key={metric.label} className={clsx('min-w-0 border-gray-100 p-5 dark:border-white/10 sm:p-7', index < 2 && 'border-b md:border-b-0', index % 2 === 0 && 'border-r', index === 1 && 'md:border-r')}>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</p>
                                        <p className="mt-3 truncate text-[28px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[34px]" title={metric.value}>{metric.value}</p>
                                        {metric.bar !== undefined ? (
                                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                                                <div className="h-full rounded-full bg-gray-950 dark:bg-white" style={{ width: `${Math.min(100, metric.bar)}%` }} />
                                            </div>
                                        ) : (
                                            <p className="mt-2 truncate text-xs text-gray-400 dark:text-gray-500">{metric.detail}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {analyticsTickets.length > 0 && (
                            <AnalyticsCharts tickets={analyticsTickets} />
                        )}

                        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-8">
                            <div className="space-y-10 lg:col-span-8">
                                <OverviewSection number="01" title="About the event">
                                    <Panel>
                                        <div className="space-y-5">
                                            <Field label="Title" htmlFor="event-title">
                                                <input id="event-title" disabled={isStaff} value={event.title} onChange={e => setEvent({ ...event, title: e.target.value })} className={clsx(inputClass, 'text-base font-medium')} placeholder="e.g. Summer Music Festival" />
                                            </Field>
                                            <Field label="Description">
                                                <RichTextEditor value={event.description} onChange={(value) => setEvent({ ...event, description: value })} placeholder="What should guests know?" readOnly={isStaff} />
                                            </Field>
                                        </div>
                                    </Panel>
                                </OverviewSection>

                                <OverviewSection number="02" title="When and where">
                                    <Panel>
                                        <div className="space-y-5">
                                            <div className="grid gap-5 md:grid-cols-2">
                                                <Field label="Starts">
                                                    <DateTimePicker
                                                        date={event.starts_at ? new Date(event.starts_at) : undefined}
                                                        setDate={(date) => setEvent({ ...event, starts_at: date ? date.toISOString() : '' })}
                                                        // No moving into the past, but an event that already started keeps its date
                                                        minDate={new Date(Math.min(Date.now(), new Date(initialEvent.starts_at).getTime()))}
                                                        disabled={isStaff}
                                                    />
                                                </Field>
                                                <Field label="Ends" optional>
                                                    <DateTimePicker
                                                        date={event.ends_at ? new Date(event.ends_at) : undefined}
                                                        setDate={(date) => setEvent({ ...event, ends_at: date ? date.toISOString() : undefined })}
                                                        minDate={event.starts_at ? new Date(event.starts_at) : undefined}
                                                        disabled={isStaff}
                                                    />
                                                </Field>
                                            </div>
                                            <div className="grid gap-5 border-t border-gray-100 pt-5 dark:border-white/10 md:grid-cols-2">
                                                <Field label="Venue" htmlFor="event-venue-name">
                                                    <input id="event-venue-name" disabled={isStaff} value={event.venue_name || ''} onChange={e => setEvent({ ...event, venue_name: e.target.value })} className={inputClass} placeholder="e.g. Independence Square" />
                                                </Field>
                                                <Field label="Address" htmlFor="event-venue-address" optional>
                                                    <input id="event-venue-address" disabled={isStaff} value={event.venue_address || ''} onChange={e => setEvent({ ...event, venue_address: e.target.value })} className={inputClass} placeholder="Street, city" />
                                                </Field>
                                            </div>
                                            <details className="group rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                                                <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 marker:hidden dark:text-gray-300">
                                                    Map pin <span className="font-normal text-gray-400">· {event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : 'optional'}</span>
                                                </summary>
                                                <div className="mt-4 grid grid-cols-2 gap-4">
                                                    <Field label="Latitude" htmlFor="event-latitude">
                                                        <input id="event-latitude" type="number" inputMode="decimal" step="any" disabled={isStaff} value={event.latitude ?? ''} onChange={e => setEvent({ ...event, latitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })} className={inputClass} placeholder="5.6037" />
                                                    </Field>
                                                    <Field label="Longitude" htmlFor="event-longitude">
                                                        <input id="event-longitude" type="number" inputMode="decimal" step="any" disabled={isStaff} value={event.longitude ?? ''} onChange={e => setEvent({ ...event, longitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })} className={inputClass} placeholder="-0.1870" />
                                                    </Field>
                                                </div>
                                            </details>
                                        </div>
                                    </Panel>
                                </OverviewSection>

                                <OverviewSection number="03" title="Media">
                                    <Panel>
                                        <div className="space-y-7">
                                            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                <Field label="Poster" hint="Looks best at 1080 × 1350 or 1080 × 1920 px.">
                                                    <MediaUploader type="image" path={`${event.organization_id}/${event.id}`} value={event.poster_url || ''} onChange={(url) => setEvent({ ...event, poster_url: url })} disabled={isStaff} />
                                                </Field>
                                                <Field label="Logo" optional hint="Square, shown on tickets.">
                                                    <div className="w-28">
                                                        <MediaUploader type="image" path={`${event.organization_id}/${event.id}`} value={event.logo_url || ''} onChange={(url) => setEvent({ ...event, logo_url: url })} aspectRatio="square" compact label="Add logo" disabled={isStaff} />
                                                    </div>
                                                </Field>
                                            </div>

                                            <div className="border-t border-gray-100 pt-6 dark:border-white/10">
                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                    <p className="text-sm font-medium text-gray-950 dark:text-white">Background video</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {event.video_url && event.video_url_portrait ? 'Both added' : event.video_url || event.video_url_portrait ? '1 of 2 added' : 'Optional'}
                                                    </p>
                                                </div>
                                                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                                    Add both cuts so the video fills the screen everywhere. If you only add one, it plays on both with bars around it. Up to 200 MB each, compressed in your browser before upload.
                                                </p>
                                                <div className="mt-4 grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
                                                    <Field label="Landscape · desktop">
                                                        <MediaUploader type="video" aspectRatio="video" expectOrientation="landscape" label="Add landscape video" path={`${event.organization_id}/${event.id}`} value={event.video_url || ''} onChange={(url) => setEvent({ ...event, video_url: url })} disabled={isStaff} />
                                                    </Field>
                                                    <Field label="Portrait · phone">
                                                        <div className="w-40 sm:w-full">
                                                            <MediaUploader type="video" aspectRatio="portrait" expectOrientation="portrait" label="Add portrait video" path={`${event.organization_id}/${event.id}`} value={event.video_url_portrait || ''} onChange={(url) => setEvent({ ...event, video_url_portrait: url })} disabled={isStaff} />
                                                        </div>
                                                    </Field>
                                                </div>
                                            </div>
                                        </div>
                                    </Panel>
                                </OverviewSection>

                                <OverviewSection number="04" title="Lineup">
                                    <Panel>
                                        <LineupTab lineup={event.lineup || []} onChange={(newLineup) => setEvent({ ...event, lineup: newLineup })} organizationId={event.organization_id || ''} disabled={isStaff} />
                                    </Panel>
                                </OverviewSection>

                                <OverviewSection number="05" title="Link and socials">
                                    <Panel>
                                        <div className="space-y-5">
                                            <Field
                                                label="Event link"
                                                htmlFor="event-slug"
                                                hint={slugStatus === 'taken' ? <span className="text-red-600 dark:text-red-400">That link is taken. Try another.</span> : slugStatus === 'available' && event.slug !== originalSlug ? 'Available.' : undefined}
                                            >
                                                <div className={clsx('flex h-11 items-center overflow-hidden rounded-xl border bg-white transition-colors focus-within:border-gray-950 dark:bg-[#111] dark:focus-within:border-white/60', slugStatus === 'taken' ? 'border-red-300 dark:border-red-500/60' : 'border-gray-200 dark:border-white/10')}>
                                                    <span className="hidden shrink-0 pl-3.5 text-[15px] text-gray-400 sm:inline">gatepass.so/events/</span>
                                                    <input id="event-slug" disabled={isStaff} value={event.slug} onChange={e => setEvent({ ...event, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[15px] text-gray-950 outline-none sm:pl-0.5 dark:text-white" placeholder="my-event" />
                                                    <span className="pr-3.5">
                                                        {slugStatus === 'checking' && <Loader2 className="size-4 animate-spin text-gray-400" aria-hidden="true" />}
                                                        {slugStatus === 'available' && <Check className="size-4 text-gray-950 dark:text-white" aria-hidden="true" />}
                                                    </span>
                                                </div>
                                            </Field>
                                            <div className="grid gap-5 border-t border-gray-100 pt-5 dark:border-white/10 sm:grid-cols-3">
                                                <Field label="Website" htmlFor="event-website" optional>
                                                    <input id="event-website" type="url" disabled={isStaff} value={event.social_website || ''} onChange={e => setEvent({ ...event, social_website: e.target.value })} className={inputClass} placeholder="https://" />
                                                </Field>
                                                <Field label="Instagram" htmlFor="event-instagram" optional>
                                                    <input id="event-instagram" disabled={isStaff} value={event.social_instagram || ''} onChange={e => setEvent({ ...event, social_instagram: e.target.value })} className={inputClass} placeholder="@handle" />
                                                </Field>
                                                <Field label="X" htmlFor="event-x" optional>
                                                    <input id="event-x" disabled={isStaff} value={event.social_twitter || ''} onChange={e => setEvent({ ...event, social_twitter: e.target.value })} className={inputClass} placeholder="@handle" />
                                                </Field>
                                            </div>
                                        </div>
                                    </Panel>
                                </OverviewSection>

                                <OverviewSection number="06" title="Appearance">
                                    <Panel>
                                        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                                            <div className="space-y-5">
                                                <Field label="Accent color">
                                                    <div className="flex flex-wrap gap-2.5">
                                                        {EVENT_COLORS.map((preset) => (
                                                            <button
                                                                key={preset.color}
                                                                type="button"
                                                                disabled={isStaff}
                                                                onClick={() => setEvent({ ...event, primary_color: preset.color })}
                                                                className={clsx('size-9 rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:ring-offset-black', event.primary_color === preset.color && 'ring-2 ring-gray-950 ring-offset-2 dark:ring-white')}
                                                                style={{ background: preset.color }}
                                                                aria-label={preset.name}
                                                                aria-pressed={event.primary_color === preset.color}
                                                            />
                                                        ))}
                                                    </div>
                                                </Field>
                                                <Field label="Custom" htmlFor="event-color-hex">
                                                    <div className="flex items-center gap-3">
                                                        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-gray-200 dark:border-white/10" style={{ background: event.primary_color || '#000000' }}>
                                                            <input type="color" aria-label="Pick a color" disabled={isStaff} value={event.primary_color || '#000000'} onChange={e => setEvent({ ...event, primary_color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                                                        </label>
                                                        <div className="relative w-40">
                                                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                                                            <input id="event-color-hex" disabled={isStaff} value={event.primary_color?.replace('#', '') || ''} onChange={e => setEvent({ ...event, primary_color: `#${e.target.value.replace(/[^0-9a-f]/gi, '')}` })} maxLength={6} placeholder="000000" className={clsx(inputClass, 'pl-7 uppercase')} />
                                                        </div>
                                                    </div>
                                                </Field>
                                            </div>
                                            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5" aria-hidden="true">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Preview</p>
                                                <p className="mt-3 truncate text-sm font-semibold text-gray-950 dark:text-white">{event.title || 'Your event'}</p>
                                                <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-full text-xs font-semibold text-white" style={{ background: event.primary_color || '#000000' }}>
                                                    <Ticket className="size-3.5" /> Get tickets
                                                </div>
                                            </div>
                                        </div>
                                    </Panel>
                                </OverviewSection>
                            </div>

                            {/* Settings rail */}
                            <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
                                {(userRole === 'Owner' || userRole === 'Admin') && (
                                    <EventBillingCard
                                        eventId={event.id}
                                        capacityKey={tiers.map(t => `${t.id}:${t.total_quantity}:${t.price}`).join('|')}
                                    />
                                )}

                                <Panel title="Visibility">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <label htmlFor="pub" className="text-sm font-medium text-gray-950 dark:text-white">Published</label>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{event.is_published ? 'Live on GatePass.' : 'Only you can see it.'}</p>
                                            </div>
                                            <Switch
                                                id="pub"
                                                label="Published"
                                                checked={event.is_published}
                                                disabled={isStaff}
                                                onChange={checked => {
                                                    if (checked && tiers.length === 0) {
                                                        toast.error('Add at least one ticket type before publishing.')
                                                        return
                                                    }
                                                    setEvent({ ...event, is_published: checked, publish_at: undefined })
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-white/10">
                                            <div>
                                                <label htmlFor="sales" className="text-sm font-medium text-gray-950 dark:text-white">Ticket sales</label>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Off shows a waitlist instead.</p>
                                            </div>
                                            <Switch id="sales" label="Ticket sales" checked={event.sales_enabled ?? true} disabled={isStaff} onChange={checked => setEvent({ ...event, sales_enabled: checked })} />
                                        </div>
                                        {!event.is_published && (
                                            <div className="border-t border-gray-100 pt-4 dark:border-white/10">
                                                <Field label="Publish later" htmlFor="event-publish-at" optional hint={event.publish_at ? `Goes live ${new Date(event.publish_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : 'Leave empty to publish yourself.'}>
                                                    <input
                                                        id="event-publish-at"
                                                        type="datetime-local"
                                                        disabled={isStaff}
                                                        value={event.publish_at ? toLocalInputValue(event.publish_at) : ''}
                                                        onChange={e => setEvent({ ...event, publish_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                                        min={toLocalInputValue(new Date().toISOString())}
                                                        className={inputClass}
                                                    />
                                                </Field>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-400">Save to apply changes.</p>
                                    </div>
                                </Panel>

                                {(userRole === 'Owner' || userRole === 'Admin') && (
                                    <EventPaymentProvider
                                        eventId={event.id}
                                        initialIntegrationId={event.payment_integration_id ?? null}
                                        initialCurrency={eventCurrency}
                                        integrations={paymentIntegrations}
                                    />
                                )}

                                {!isStaff ? (
                                    <>
                                        <PrimaryButton type="button" onClick={() => updateEvent()} loading={loading} className="w-full">
                                            {loading ? 'Saving…' : 'Save changes'}
                                        </PrimaryButton>
                                        <div className="rounded-3xl border border-red-200/70 p-5 dark:border-red-500/20 sm:p-6">
                                            <h3 className="text-base font-semibold text-gray-950 dark:text-white">Delete event</h3>
                                            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">Removes the event, its tickets and its guest list for good.</p>
                                            <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="mt-4 inline-flex h-9 items-center rounded-full border border-red-200 px-4 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10">
                                                Delete event
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <Notice>
                                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-950 dark:text-white"><ShieldCheck className="size-4" aria-hidden="true" /> View only</span>
                                        <br />Owners and admins can make changes.
                                    </Notice>
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
                            </aside>
                        </div>
                    </div>
                )
            }

            {/* TICKETS TAB */}
            {
                activeTab === 'tickets' && (
                    <TicketsTab event={event} tiers={tiers} onTiersUpdate={setTiers} isStaff={isStaff} />
                )
            }

            {/* ADD-ONS TAB */}
            {activeTab === 'addons' && (
                <AddonsTab
                    addons={addons}
                    eventId={event.id}
                    organizationId={event.organization_id || ''}
                    currency={(event.currency || tiers[0]?.currency || 'GHS').toUpperCase()}
                    onUpdate={refreshAddons}
                    tiers={tiers}
                />
            )}

            {/* WIDGETS TAB */}
            {activeTab === 'widgets' && (
                <WidgetsTab event={event} />
            )}


            {/* ATTENDEES TAB */}
            {
                activeTab === 'attendees' && (
                    <AttendeesTab event={event} tiers={tiers} isStaff={isStaff} />
                )
            }

            {/* PROMOTIONS TAB */}
            {activeTab === 'discounts' && (
                <PromotionsTab eventId={event.id} eventSlug={event.slug} currency={eventCurrency} tiers={tiers} />
            )}

            {/* FORMS TAB */}
            {activeTab === 'forms' && <FormsTab eventId={event.id} eventSlug={event.slug} />}

            {/* TEAM TAB */}
            {
                activeTab === 'team' && (
                    <StaffTab eventId={event.id} isStaff={isStaff} />
                )
            }
        </div >
    )
}
