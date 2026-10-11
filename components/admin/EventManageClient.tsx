'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowUpRight, Calendar, MapPin, Ticket, Plus, Search, ScanLine, Check, Trash2, Eye, Copy, Download, ShieldCheck, Loader2, CopyPlus, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Event, TicketTier, Discount, EventFormQuestion } from '@/types/gatepass'
import clsx from 'clsx'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'
import { calculateFees, FeeRates, getEffectiveFeeRates } from '@/utils/fees'
import dynamic from 'next/dynamic'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import { logActivity } from '@/app/actions/logger'
import { updateEventFee, updateEventFeeBearer } from '@/app/actions/fees'
import { requestPayout } from '@/app/actions/payouts'
import { duplicateEvent } from '@/app/actions/events'
import { Input } from '@/components/ui/Input'
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
    const isAdmin = userRole === 'Owner' || userRole === 'Admin' || isSuperAdmin
    const [event, setEvent] = useState(initialEvent)
    const supabase = createClient()
    const [activeTab, setActiveTab] = useState<'details' | 'tickets' | 'attendees' | 'discounts' | 'payouts' | 'team' | 'lineup' | 'addons' | 'widgets' | 'instalments' | 'forms'>('details')
    const sectionNavRef = React.useRef<HTMLElement>(null)
    const [loading, setLoading] = useState(false)
    const [addons, setAddons] = useState<any[]>([])

    // Custom Forms State
    const [questions, setQuestions] = useState<EventFormQuestion[]>([])
    const [fetchingQuestions, setFetchingQuestions] = useState(false)
    const [questionForm, setQuestionForm] = useState({
        label: '',
        type: 'text' as 'text' | 'select' | 'checkbox',
        options: '',
        required: false
    })
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
    const [savingQuestion, setSavingQuestion] = useState(false)

    const [formResponses, setFormResponses] = useState<any[]>([])
    const [fetchingResponses, setFetchingResponses] = useState(false)
    const [formsSubTab, setFormsSubTab] = useState<'builder' | 'responses'>('builder')
    const [responseSearchQuery, setResponseSearchQuery] = useState('')

    // Tickets State
    const [tiers, setTiers] = useState<TicketTier[]>(initialTiers) // Kept initialTiers from props




    // Discounts State
    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [discountPage, setDiscountPage] = useState(0)

    React.useEffect(() => {
        if (discountPage > 0 && discountPage * 5 >= discounts.length) {
            setDiscountPage(Math.max(0, Math.ceil(discounts.length / 5) - 1))
        }
    }, [discounts.length, discountPage])
    const [discountForm, setDiscountForm] = useState({
        code: '',
        type: 'percentage' as 'percentage' | 'fixed',
        value: 0,
        max_uses: 0,
        tier_id: '',
        expires_at: '',
        linked_utm_campaign: '',
        affiliate_email: '',
        affiliate_commission_percent: 10
    })
    const [creatingDiscount, setCreatingDiscount] = useState(false)
    const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null)
    const [showDiscountForm, setShowDiscountForm] = useState(false)

    // Payouts State
    const [payoutStats, setPayoutStats] = useState({ totalCollected: 0, platformFee: 0, organizerNet: 0, transactionCount: 0, totalAddons: 0 })
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingPayouts, setLoadingPayouts] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
    const [payoutPage, setPayoutPage] = useState(0)
    const [payoutCount, setPayoutCount] = useState(0)
    const [activePayout, setActivePayout] = useState<any>(null)
    const [payoutRequests, setPayoutRequests] = useState<any[]>([])

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState(false)

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
            toast.error('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    // ---------------- CUSTOM FORMS LOGIC ----------------
    const fetchQuestions = async () => {
        setFetchingQuestions(true)
        const { data } = await supabase
            .schema('gatepass')
            .from('event_form_questions')
            .select('*')
            .eq('event_id', event.id)
            .order('sort_order', { ascending: true })
        if (data) {
            setQuestions(data as EventFormQuestion[])
        }
        setFetchingQuestions(false)
    }

    const fetchResponses = async () => {
        setFetchingResponses(true)
        const { data } = await supabase
            .schema('gatepass')
            .from('event_form_responses')
            .select(`
                id,
                created_at,
                answer,
                question_id,
                event_form_questions!inner(
                    label,
                    type,
                    event_id
                ),
                reservations!inner(
                    guest_name,
                    guest_email,
                    id
                )
            `)
            .eq('event_form_questions.event_id', event.id)
            .order('created_at', { ascending: false })

        if (data) {
            setFormResponses(data)
        }
        setFetchingResponses(false)
    }

    const handleSaveQuestion = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!questionForm.label.trim()) {
            toast.error('Question text is required')
            return
        }

        setSavingQuestion(true)
        try {
            const optionsArray = questionForm.type === 'select'
                ? questionForm.options.split(',').map(s => s.trim()).filter(Boolean)
                : null

            if (editingQuestionId) {
                const { error } = await supabase
                    .schema('gatepass')
                    .from('event_form_questions')
                    .update({
                        label: questionForm.label.trim(),
                        type: questionForm.type,
                        options: optionsArray,
                        required: questionForm.required
                    })
                    .eq('id', editingQuestionId)

                if (error) throw new Error(error.message)
                toast.success('Question updated!')
                setEditingQuestionId(null)
            } else {
                const nextSortOrder = questions.length > 0
                    ? Math.max(...questions.map(q => q.sort_order)) + 1
                    : 0

                const { error } = await supabase
                    .schema('gatepass')
                    .from('event_form_questions')
                    .insert({
                        event_id: event.id,
                        label: questionForm.label.trim(),
                        type: questionForm.type,
                        options: optionsArray,
                        required: questionForm.required,
                        sort_order: nextSortOrder
                    })

                if (error) throw new Error(error.message)
                toast.success('Question created!')
            }

            setQuestionForm({
                label: '',
                type: 'text',
                options: '',
                required: false
            })
            await fetchQuestions()
        } catch (err: any) {
            toast.error(err.message || 'Failed to save question')
        } finally {
            setSavingQuestion(false)
        }
    }

    const startEditingQuestion = (q: EventFormQuestion) => {
        setEditingQuestionId(q.id)
        setQuestionForm({
            label: q.label,
            type: q.type,
            options: q.options ? q.options.join(', ') : '',
            required: q.required
        })
    }

    const handleDeleteQuestion = async (id: string) => {
        if (!confirm('Are you sure you want to delete this question? Any submitted answers to this question will also be deleted.')) return
        const { error } = await supabase
            .schema('gatepass')
            .from('event_form_questions')
            .delete()
            .eq('id', id)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Question deleted')
            await fetchQuestions()
        }
    }

    const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === questions.length - 1) return

        const targetIndex = direction === 'up' ? index - 1 : index + 1
        const currentQ = questions[index]
        const targetQ = questions[targetIndex]

        const { error: err1 } = await supabase
            .schema('gatepass')
            .from('event_form_questions')
            .update({ sort_order: targetQ.sort_order })
            .eq('id', currentQ.id)

        const { error: err2 } = await supabase
            .schema('gatepass')
            .from('event_form_questions')
            .update({ sort_order: currentQ.sort_order })
            .eq('id', targetQ.id)

        if (err1 || err2) {
            toast.error('Failed to reorder questions')
        } else {
            await fetchQuestions()
        }
    }

    const handleExportResponses = () => {
        if (formResponses.length === 0) {
            toast.error('No responses to export')
            return
        }

        const headers = ['Guest Name', 'Guest Email', 'Question', 'Answer', 'Submitted At']
        const rows = formResponses.map(r => [
            r.reservations?.guest_name || '',
            r.reservations?.guest_email || '',
            r.event_form_questions?.label || '',
            r.answer || '',
            new Date(r.created_at).toLocaleString()
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `${event.slug}-form-responses.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Responses exported!')
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
                    tier_id: discountForm.tier_id || null,
                    expires_at: discountForm.expires_at || null,
                    linked_utm_campaign: discountForm.linked_utm_campaign || null,
                    affiliate_email: discountForm.affiliate_email || null,
                    affiliate_commission_percent: discountForm.affiliate_commission_percent
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
                    tier_id: discountForm.tier_id || null,
                    expires_at: discountForm.expires_at || null,
                    linked_utm_campaign: discountForm.linked_utm_campaign || null,
                    affiliate_email: discountForm.affiliate_email || null,
                    affiliate_commission_percent: discountForm.affiliate_commission_percent
                })

                if (error) throw error
                toast.success('Discount code created!')
            }

            await fetchDiscounts()
            setShowDiscountForm(false)
            setDiscountForm({
                code: '',
                type: 'percentage',
                value: 0,
                max_uses: 0,
                tier_id: '',
                expires_at: '',
                linked_utm_campaign: '',
                affiliate_email: '',
                affiliate_commission_percent: 10
            })
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setCreatingDiscount(false)
        }
    }

    const startEditingDiscount = (discount: Discount) => {
        setEditingDiscountId(discount.id)
        setShowDiscountForm(true)
        setDiscountForm({
            code: discount.code,
            type: discount.type,
            value: discount.value,
            max_uses: discount.max_uses || 0,
            tier_id: discount.tier_id || '',
            expires_at: discount.expires_at || '',
            linked_utm_campaign: discount.linked_utm_campaign || '',
            affiliate_email: discount.affiliate_email || '',
            affiliate_commission_percent: discount.affiliate_commission_percent || 10
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEditingDiscount = () => {
        setEditingDiscountId(null)
        setShowDiscountForm(false)
        setDiscountForm({
            code: '',
            type: 'percentage',
            value: 0,
            max_uses: 0,
            tier_id: '',
            expires_at: '',
            linked_utm_campaign: '',
            affiliate_email: '',
            affiliate_commission_percent: 10
        })
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
                        ticket_tiers ( price, min_quantity, discount_value, discount_type ),
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
                        ticket_tiers ( price, min_quantity, discount_value, discount_type ),
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

            const payoutRequestsQuery = supabase
                .schema('gatepass')
                .from('payouts')
                .select('*')
                .eq('event_id', event.id)
                .order('created_at', { ascending: false })

            const [statsRes, listRes, activePayoutRes, payoutRequestsRes] = await Promise.all([statsQuery, listQuery, activePayoutQuery, payoutRequestsQuery])

            if (statsRes.error) throw statsRes.error
            if (listRes.error) throw listRes.error
            if (activePayoutRes.error) throw activePayoutRes.error
            if (payoutRequestsRes.error) throw payoutRequestsRes.error

            setTransactions(listRes.data || [])
            setPayoutCount(listRes.count || 0)
            setActivePayout(activePayoutRes.data)
            setPayoutRequests(payoutRequestsRes.data || [])

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
                const ticketTier = tx.reservations?.ticket_tiers || tiers.find(t => t.id === tx.reservations?.tier_id)
                const basePrice = ticketTier?.price || 0
                const quantity = tx.reservations?.quantity || 1
                let tierSubtotal = basePrice * quantity

                if (ticketTier && ticketTier.min_quantity && quantity >= ticketTier.min_quantity && ticketTier.discount_value) {
                    const discountValue = ticketTier.discount_value || 0
                    if (ticketTier.discount_type === 'percentage') {
                        tierSubtotal = tierSubtotal - (tierSubtotal * (discountValue / 100))
                    } else if (ticketTier.discount_type === 'fixed') {
                        tierSubtotal = Math.max(0, tierSubtotal - discountValue)
                    }
                }
                let price = quantity > 0 ? (tierSubtotal / quantity) : basePrice

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
                // Normalize old 2% rate to current 1.95%
                const storedProcessorRate = tx.applied_processor_rate
                const appliedProcessorRate = (storedProcessorRate === 0.02 || !storedProcessorRate)
                    ? effectiveRates.processorFeePercent
                    : storedProcessorRate

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

            const amountPaid = payoutRequestsRes.data?.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + p.amount, 0) || 0
            const activeAmount = activePayoutRes.data ? activePayoutRes.data.amount : 0

            setPayoutStats({
                totalCollected: totalVolume,
                platformFee: totalPlatformFees,
                organizerNet: Math.max(0, totalOrganizerNet - amountPaid - activeAmount),
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
        if (activeTab === 'forms') {
            fetchQuestions()
            fetchResponses()
        }
    }, [activeTab])

    const tabClass = (tab: string) => clsx(
        "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors sm:px-5",
        activeTab === tab
            ? "border-black text-black dark:border-white dark:text-white"
            : "border-transparent text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
    )

    React.useEffect(() => {
        const nav = sectionNavRef.current
        const selected = nav?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
        if (!nav || !selected) return
        const navBounds = nav.getBoundingClientRect()
        const selectedBounds = selected.getBoundingClientRect()
        const left = nav.scrollLeft + selectedBounds.left - navBounds.left - (nav.clientWidth - selectedBounds.width) / 2
        nav.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }, [activeTab])



    const filteredFormResponses = formResponses.filter(response => {
        const query = responseSearchQuery.toLowerCase().trim()
        return !query ||
            response.reservations?.guest_name?.toLowerCase().includes(query) ||
            response.reservations?.guest_email?.toLowerCase().includes(query) ||
            response.answer?.toLowerCase().includes(query) ||
            response.event_form_questions?.label?.toLowerCase().includes(query)
    })

    return (
        <div className="mx-auto max-w-[1180px] space-y-7 pb-16 font-sans">
            {/* Header */}
            <div className="space-y-5">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Link href="/dashboard/events" className="hover:text-black dark:hover:text-white transition-colors">Events</Link>
                    <span aria-hidden="true">/</span>
                    <span className="truncate text-gray-900 dark:text-white">{event.title}</span>
                </div>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-gray-950 dark:text-white sm:text-[38px]">{event.title}</h1>
                            <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", event.is_published ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-400")}>
                                <span className={clsx("h-1.5 w-1.5 rounded-full", event.is_published ? "bg-emerald-500" : "bg-gray-400")} />
                                {event.is_published ? 'Published' : 'Draft'}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                            {event.venue_name && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.venue_name}</span>}
                            <span className="inline-flex items-center gap-1.5" suppressHydrationWarning><Calendar className="h-3.5 w-3.5" />{new Date(event.starts_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                        <Link href={`/events/${event.slug || event.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400 dark:border-white/10 dark:bg-[#111] dark:text-white dark:hover:border-white/30">
                            View event page <ArrowUpRight className="h-4 w-4" />
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
                                            toast.success('Event duplicated! Redirecting...')
                                            router.push(`/dashboard/events/${result.eventId}`)
                                        }
                                    } catch (e: any) {
                                        toast.error('Failed to duplicate: ' + e.message)
                                    } finally {
                                        setIsDuplicating(false)
                                    }
                                }}
                                disabled={isDuplicating}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400 disabled:opacity-50 dark:border-white/10 dark:bg-[#111] dark:text-white dark:hover:border-white/30"
                            >
                                {isDuplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
                                {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                            </button>
                        )}
                        {activeTab === 'details' && !isStaff && <button
                            onClick={() => updateEvent()}
                            disabled={loading}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
                        >
                            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                            {loading ? 'Saving...' : 'Save event'}
                        </button>}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav ref={sectionNavRef} className="overflow-x-auto border-b border-gray-200 dark:border-white/10" aria-label="Event sections">
                <div className="flex min-w-max items-center">
                    <button aria-pressed={activeTab === 'details'} onClick={() => setActiveTab('details')} className={tabClass('details')}>Overview</button>
                    <button aria-pressed={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} className={tabClass('tickets')}>Tickets</button>
                    <button aria-pressed={activeTab === 'attendees'} onClick={() => setActiveTab('attendees')} className={tabClass('attendees')}>Guest list</button>
                    {isAdmin && (
                        <button aria-pressed={activeTab === 'discounts'} onClick={() => setActiveTab('discounts')} className={tabClass('discounts')}>Promotions</button>
                    )}
                    {isAdmin && (
                        <button aria-pressed={activeTab === 'payouts'} onClick={() => setActiveTab('payouts')} className={tabClass('payouts')}>Payouts</button>
                    )}
                    {isAdmin && (
                        <button aria-pressed={activeTab === 'instalments'} onClick={() => setActiveTab('instalments')} className={tabClass('instalments')}>Instalments</button>
                    )}
                    {isAdmin && (
                        <button aria-pressed={activeTab === 'forms'} onClick={() => setActiveTab('forms')} className={tabClass('forms')}>Forms</button>
                    )}
                    <button aria-pressed={activeTab === 'addons'} onClick={() => setActiveTab('addons')} className={tabClass('addons')}>Add-ons</button>
                    <button aria-pressed={activeTab === 'widgets'} onClick={() => setActiveTab('widgets')} className={tabClass('widgets')}>Widgets</button>
                    <button aria-pressed={activeTab === 'team'} onClick={() => setActiveTab('team')} className={tabClass('team')}>Team</button>
                </div>
            </nav>


            {/* PAYOUTS TAB */}
            {activeTab === 'payouts' && (
                <div className="space-y-6 animate-in fade-in duration-200" aria-busy={loadingPayouts}>
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">Payouts</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review ticket payments and your available balance.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Organizer Due Card */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                            <div className="flex h-full flex-col justify-between gap-6">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available to request</p>
                                    <h2 className="mt-3 truncate text-4xl font-semibold tracking-tight text-gray-950 dark:text-white" title={formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}>
                                        {loadingPayouts ? 'Loading…' : formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}
                                    </h2>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">After previous and pending payouts. {event.fee_bearer === 'organizer' ? 'Processing fees are deducted from your earnings.' : 'The customer pays processing fees.'}</p>
                                    {!activePayout && (
                                        <div className="border-t border-gray-200 pt-4 dark:border-white/10">
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Transfer fees</p>
                                            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                                GHS 1.00 for Mobile Money / GHS 8.00 for Bank transfers will be deducted from your final payout.
                                            </p>
                                        </div>
                                    )}
                                    {activePayout ? (
                                        <div className="flex w-full cursor-not-allowed flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-3 font-medium text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Processing payout</span>
                                            </div>
                                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                                {formatCurrency(activePayout.amount, activePayout.currency)} requested on {new Date(activePayout.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleRequestPayout}
                                            disabled={loadingPayouts || requestingPayout || payoutStats.organizerNet <= 0}
                                            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
                                        >
                                            {requestingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : loadingPayouts ? 'Loading balance…' : 'Request payout'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Card */}
                        <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/10">
                                <h3 className="text-base font-semibold text-gray-950 dark:text-white">
                                    Financial summary
                                </h3>
                            </div>

                            <div className="space-y-5 flex-1">
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Gross sales</span>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg tabular-nums">{formatCurrency(payoutStats.totalCollected, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Transactions</span>
                                    <span className="font-bold text-gray-900 dark:text-white text-lg tabular-nums">{payoutStats.transactionCount}</span>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-white/10 w-full" />
                                <div className="flex justify-between items-center group">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Platform and processing fees</span>
                                    </div>
                                    <span className="font-bold text-red-500 text-lg tabular-nums">
                                        - {formatCurrency(payoutStats.platformFee, initialTiers?.[0]?.currency || 'GHS')}
                                    </span>
                                </div>
                                {payoutRequests.some((request: any) => request.status === 'paid') && (
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Previously paid out</span>
                                        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">− {formatCurrency(payoutRequests.filter((request: any) => request.status === 'paid').reduce((total: number, request: any) => total + request.amount, 0), initialTiers?.[0]?.currency || 'GHS')}</span>
                                    </div>
                                )}
                                {activePayout && (
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Payout in progress</span>
                                        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">− {formatCurrency(activePayout.amount, initialTiers?.[0]?.currency || 'GHS')}</span>
                                    </div>
                                )}
                                <div className="h-px bg-gray-100 dark:bg-white/10 w-full" />
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10">
                                    <span className="font-semibold text-gray-900 dark:text-white">Available balance</span>
                                    <span className="text-xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">{formatCurrency(payoutStats.organizerNet, initialTiers?.[0]?.currency || 'GHS')}</span>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Transaction History Table */}
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
                        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/10 flex items-center justify-center border border-gray-100 dark:border-white/10">
                                    <ScanLine className="w-5 h-5 text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Recent transactions</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{payoutCount} successful payments found</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const csv = generateCSV(transactions)
                                    downloadCSV(csv, `gatepass-transactions-${event.slug}`)
                                }}
                                disabled={transactions.length === 0}
                                className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400 disabled:pointer-events-none disabled:opacity-40 dark:border-white/10 dark:bg-[#111] dark:text-white sm:self-auto"
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
                                            <th className="px-5 py-3 text-right font-medium">Net payout</th>
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
                                            const appliedProcessorRate = (storedProcessorRate2 === 0.02 || !storedProcessorRate2)
                                                ? effectiveRates.processorFeePercent
                                                : storedProcessorRate2

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
                                                        <span className="text-gray-500 md:hidden">Net payout</span>
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
                        {payoutCount > 20 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/30 px-5 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
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

                    {/* Payout Requests History */}
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
                        <div className="border-b border-gray-100 p-5 dark:border-white/10 sm:p-6">
                            <h3 className="text-base font-semibold text-gray-950 dark:text-white">Payout requests</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{payoutRequests.length} {payoutRequests.length === 1 ? 'request' : 'requests'}</p>
                        </div>

                        {payoutRequests.length > 0 ? (
                            <>
                            <div className="space-y-2 p-4 md:hidden">
                                {payoutRequests.map((req: any) => (
                                    <div key={req.id} className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(req.created_at).toLocaleDateString()}</p>
                                                <p className="mt-1 text-base font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(req.amount, req.currency)}</p>
                                            </div>
                                            <span className={clsx(
                                                "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                                                req.status === 'paid' ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                                                    req.status === 'pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" :
                                                        req.status === 'processing' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                            "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                            )}>{req.status}</span>
                                        </div>
                                        {(req.reference || req.notes) && (
                                            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs dark:border-white/10">
                                                {req.reference && <p className="break-all text-gray-500 dark:text-gray-400">Reference: {req.reference}</p>}
                                                {req.notes && <p className="break-words text-gray-600 dark:text-gray-300">{req.notes}</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[660px] text-left text-sm">
                                    <thead className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Date</th>
                                            <th className="px-5 py-3 font-medium">Amount</th>
                                            <th className="px-5 py-3 font-medium">Status</th>
                                            <th className="px-5 py-3 font-medium">Reference</th>
                                            <th className="px-5 py-3 font-medium">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                        {payoutRequests.map((req: any) => (
                                            <tr key={req.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-400">
                                                    {new Date(req.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-4 font-semibold tabular-nums text-gray-900 dark:text-white">
                                                    {formatCurrency(req.amount, req.currency)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={clsx(
                                                        "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                                                        req.status === 'paid' ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                                                            req.status === 'pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" :
                                                                req.status === 'processing' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                                    "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                                    )}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                                                    {req.reference || '-'}
                                                </td>
                                                <td className="max-w-xs truncate px-5 py-4 text-gray-500 dark:text-gray-400" title={req.notes}>
                                                    {req.notes || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            </>
                        ) : (
                            <div className="px-5 py-14 text-center">
                                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">No payout requests</h3>
                                <p className="mx-auto max-w-xs text-sm text-gray-500 dark:text-gray-400">
                                    Payout requests will appear here.
                                </p>
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
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                            {[
                                { label: 'Net revenue', value: formatCurrency(stats.totalRevenue, initialTiers?.[0]?.currency || 'GHS'), detail: 'After fees' },
                                { label: 'Tickets sold', value: stats.totalSold.toLocaleString(), detail: `of ${stats.totalCapacity.toLocaleString()} available` },
                                { label: 'Page views', value: (event.view_count || 0).toLocaleString(), detail: 'Event page' },
                                { label: 'Capacity filled', value: `${stats.utilization.toFixed(1)}%`, detail: 'Across all ticket types' },
                                { label: 'Discounts', value: formatCurrency(initialTotalDiscountValue, initialTiers?.[0]?.currency || 'GHS'), detail: 'Applied to sales' },
                            ].map((metric) => (
                                <div key={metric.label} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 last:col-span-2 dark:border-white/10 dark:bg-[#111] sm:last:col-span-1 sm:p-5">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
                                    <p className="mt-4 truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white" title={metric.value}>{metric.value}</p>
                                    <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500" title={metric.detail}>{metric.detail}</p>
                                </div>
                            ))}
                        </div>

                        {/* 2. Charts Row */}
                        {analyticsTickets.length > 0 && (
                            <AnalyticsCharts tickets={analyticsTickets} />
                        )}

                        <div>
                            <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">Event details</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the information and presentation of your event.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                            {/* LEFT COLUMN (8 cols) */}
                            <div className="space-y-5 lg:col-span-8">

                                {/* General Info */}
                                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">About the event</h3>
                                    <div className="grid gap-6">
                                        <div>
                                            <label htmlFor="event-title" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Event title</label>
                                            <input
                                                id="event-title"
                                                disabled={isStaff}
                                                value={event.title}
                                                onChange={e => setEvent({ ...event, title: e.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-base font-medium text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                placeholder="E.g. Summer Music Festival"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
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
                                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Lineup</h3>
                                    <LineupTab
                                        lineup={event.lineup || []}
                                        onChange={(newLineup) => setEvent({ ...event, lineup: newLineup })}
                                        organizationId={event.organization_id || ''}
                                        disabled={isStaff}
                                    />
                                </div>

                                {/* Timing & URL (Moved from Right) */}
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    {/* Date & Time */}
                                    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                        <h3 className="text-base font-semibold text-gray-950 dark:text-white">Date and time</h3>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Starts</label>
                                            <DateTimePicker
                                                date={event.starts_at ? new Date(event.starts_at) : undefined}
                                                setDate={(date) => setEvent({ ...event, starts_at: date ? date.toISOString() : '' })}
                                                disabled={isStaff}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Ends</label>
                                            <DateTimePicker
                                                date={event.ends_at ? new Date(event.ends_at) : undefined}
                                                setDate={(date) => setEvent({ ...event, ends_at: date ? date.toISOString() : undefined })}
                                                disabled={isStaff}
                                            />
                                        </div>
                                    </div>

                                    {/* URL Slug */}
                                    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                        <h3 className="text-base font-semibold text-gray-950 dark:text-white">Event URL</h3>
                                        <div>
                                            <div className="flex flex-col">
                                                <label htmlFor="event-slug" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Link ending</label>
                                                <span className="mb-1 text-xs text-gray-400">gatepass.so/events/</span>
                                                <div className="relative">
                                                    <input
                                                        id="event-slug"
                                                        disabled={isStaff}
                                                        value={event.slug}
                                                        onChange={e => setEvent({ ...event, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                                        className={`w-full rounded-lg border bg-white p-3 text-sm font-medium outline-none dark:bg-white/5 dark:text-white disabled:opacity-70 ${slugStatus === 'taken'
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
                                    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="text-base font-semibold text-gray-950 dark:text-white">Financial settings</h3>
                                            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                                {feeSource}
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Platform fee override (%)</label>
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
                                                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                                    Effective rate: <span className="font-medium text-gray-900 dark:text-white">{(getEffectiveFeeRates(feeRates, event).platformFeePercent * 100).toFixed(2)}%</span>. Leave empty to use the organizer or system rate.
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 dark:border-white/10">
                                                <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Who pays the fees?</p>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBearer = 'customer';
                                                            setEvent({ ...event, fee_bearer: newBearer }); // Optimistic
                                                            updateEventFeeBearer(event.id, newBearer).then(() => toast.success('Fee bearer updated')).catch(e => toast.error(e.message));
                                                        }}
                                                        className={clsx(
                                                            "flex flex-col gap-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                                                            event.fee_bearer === 'customer'
                                                                ? "border-black bg-gray-50 text-gray-900 dark:border-white dark:bg-white/10 dark:text-white"
                                                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                                                        )}
                                                    >
                                                        <span>Customer</span>
                                                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Fees added to total</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBearer = 'organizer';
                                                            setEvent({ ...event, fee_bearer: newBearer }); // Optimistic
                                                            updateEventFeeBearer(event.id, newBearer).then(() => toast.success('Fee bearer updated')).catch(e => toast.error(e.message));
                                                        }}
                                                        className={clsx(
                                                            "flex flex-col gap-1 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                                                            event.fee_bearer === 'organizer'
                                                                ? "border-black bg-gray-50 text-gray-900 dark:border-white dark:bg-white/10 dark:text-white"
                                                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                                                        )}
                                                    >
                                                        <span>Organizer</span>
                                                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Fees deducted from payout</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Poster Image */}
                                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="mb-4 text-base font-semibold text-gray-950 dark:text-white">Event poster</h3>
                                    <div className="space-y-4">
                                        <MediaUploader
                                            type="image"
                                            path={`${event.organization_id}/${event.id}`}
                                            value={event.poster_url || ''}
                                            onChange={(url) => setEvent({ ...event, poster_url: url })}
                                            disabled={isStaff}
                                            className="max-w-md"
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Recommended: 1080 × 1350 px or 1080 × 1920 px. Max 5 MB.
                                        </p>
                                    </div>
                                </div>


                                {/* Event Logo */}
                                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="mb-4 text-base font-semibold text-gray-950 dark:text-white">Event logo</h3>
                                    <div className="space-y-4">
                                        <div className="w-28">
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
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Shown on ticket cards. Use a square image.
                                        </p>
                                    </div>
                                </div>




                                {/* Event Video */}
                                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="mb-4 text-base font-semibold text-gray-950 dark:text-white">Event video</h3>
                                    <div className="space-y-4">
                                        <MediaUploader
                                            type="video"
                                            path={`${event.organization_id}/${event.id}`}
                                            value={event.video_url || ''}
                                            onChange={(url) => setEvent({ ...event, video_url: url })}
                                            disabled={isStaff}
                                            className="max-w-lg"
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Short teaser video, 15–30 seconds. Max 50 MB.
                                        </p>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Location</h3>
                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label htmlFor="event-venue-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Venue name</label>
                                                <input
                                                    id="event-venue-name"
                                                    disabled={isStaff}
                                                    value={event.venue_name || ''}
                                                    onChange={e => setEvent({ ...event, venue_name: e.target.value })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                    placeholder="Venue Name"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="event-venue-address" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Venue address</label>
                                                <input
                                                    id="event-venue-address"
                                                    disabled={isStaff}
                                                    value={event.venue_address || ''}
                                                    onChange={e => setEvent({ ...event, venue_address: e.target.value })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                    placeholder="Physical Address"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 dark:border-white/10 sm:grid-cols-2">
                                            <div>
                                                <label htmlFor="event-latitude" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Latitude</label>
                                                <input
                                                    id="event-latitude"
                                                    type="number"
                                                    disabled={isStaff}
                                                    step="any"
                                                    value={event.latitude || ''}
                                                    onChange={e => setEvent({ ...event, latitude: parseFloat(e.target.value) })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                    placeholder="5.6037"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="event-longitude" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Longitude</label>
                                                <input
                                                    id="event-longitude"
                                                    type="number"
                                                    disabled={isStaff}
                                                    step="any"
                                                    value={event.longitude || ''}
                                                    onChange={e => setEvent({ ...event, longitude: parseFloat(e.target.value) })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                    placeholder="-0.1870"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>



                            </div>

                            {/* RIGHT COLUMN (4 cols) - Settings */}
                            <div className="space-y-5 lg:col-span-4">

                                {/* Publish Status - High Priority */}
                                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#111]">
                                    <h3 className="mb-4 text-base font-semibold text-gray-950 dark:text-white">Visibility</h3>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Publish event</span>
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
                                                    setEvent({ ...event, is_published: e.target.checked, publish_at: undefined })
                                                }}
                                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                                style={{ right: event.is_published ? '0' : 'auto', left: event.is_published ? 'auto' : '0' }}
                                            />
                                            <label htmlFor="pub" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${event.is_published ? 'bg-black dark:bg-gray-600' : 'bg-gray-300 dark:bg-white/20'}`}></label>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/10">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ticket sales</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Enable checkout or show waitlist</span>
                                        </div>
                                        <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                name="sales_toggle"
                                                id="sales"
                                                checked={event.sales_enabled ?? true}
                                                onChange={e => {
                                                    setEvent({ ...event, sales_enabled: e.target.checked })
                                                }}
                                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                                style={{ right: (event.sales_enabled ?? true) ? '0' : 'auto', left: (event.sales_enabled ?? true) ? 'auto' : '0' }}
                                            />
                                            <label htmlFor="sales" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${(event.sales_enabled ?? true) ? 'bg-black dark:bg-gray-600' : 'bg-gray-300 dark:bg-white/20'}`}></label>
                                        </div>
                                    </div>

                                    {/* Scheduled Publishing */}
                                    {!event.is_published && (
                                        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/10">
                                            <label htmlFor="event-publish-at" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Schedule publication
                                            </label>
                                            <input
                                                id="event-publish-at"
                                                type="datetime-local"
                                                value={event.publish_at ? new Date(event.publish_at).toISOString().slice(0, 16) : ''}
                                                onChange={e => {
                                                    const value = e.target.value
                                                    if (value) {
                                                        setEvent({ ...event, publish_at: new Date(value).toISOString() })
                                                    } else {
                                                        setEvent({ ...event, publish_at: undefined })
                                                    }
                                                }}
                                                min={new Date().toISOString().slice(0, 16)}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                            />
                                            {event.publish_at && (
                                                <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                    Scheduled for {new Date(event.publish_at).toLocaleString()}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-2">
                                                Leave empty to publish manually
                                            </p>
                                        </div>
                                    )}

                                    <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                        {event.is_published
                                            ? 'Your event is live and visible to the public.'
                                            : event.publish_at
                                                ? 'Your event will be automatically published at the scheduled time.'
                                                : 'When published, your event will be visible to the public and tickets will be available for purchase.'
                                        }
                                    </p>
                                </div>

                                {/* Branding (Moved from Left) */}
                                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Event appearance</h3>

                                    <div className="space-y-5">
                                        {/* Presets */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme color</label>
                                            <div className="flex flex-wrap gap-2.5">
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
                                                            "h-9 w-9 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2",
                                                            event.primary_color === preset.color ? "ring-2 ring-offset-2 ring-gray-500 dark:ring-white" : "border-transparent hover:border-gray-300 dark:hover:border-white/40"
                                                        )}
                                                        style={{ background: preset.color }}
                                                        title={preset.name}
                                                        aria-label={preset.name}
                                                        aria-pressed={event.primary_color === preset.color}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Input */}
                                        <div>
                                            <label htmlFor="event-color-hex" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Custom color</label>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <input
                                                        type="color"
                                                        aria-label="Choose custom color"
                                                        value={event.primary_color || '#000000'}
                                                        onChange={e => setEvent({ ...event, primary_color: e.target.value })}
                                                        className="w-12 h-12 rounded-xl cursor-pointer bg-white border border-gray-200 p-1 opacity-0 absolute inset-0 z-10"
                                                    />
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 p-1" style={{ background: event.primary_color || '#000000' }}>
                                                        <div className="w-full h-full rounded-lg border border-white/20" />
                                                    </div>
                                                </div>
                                                <div className="relative flex-1">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">#</span>
                                                    <input
                                                        id="event-color-hex"
                                                        value={event.primary_color?.replace('#', '') || ''}
                                                        onChange={e => setEvent({ ...event, primary_color: `#${e.target.value}` })}
                                                        type="text"
                                                        maxLength={6}
                                                        placeholder="000000"
                                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm font-medium uppercase text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Live Preview */}
                                        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5">
                                            <p className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">Preview</p>
                                            <div className="mx-auto max-w-[240px] rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#111]">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10" />
                                                    <div className="space-y-1">
                                                        <div className="w-20 h-2 bg-gray-100 dark:bg-white/10 rounded-full" />
                                                        <div className="w-12 h-2 bg-gray-50 dark:bg-white/5 rounded-full" />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-white"
                                                    style={{ background: event.primary_color || '#000000' }}
                                                >
                                                    <Ticket className="w-3 h-3" />
                                                    Get Tickets
                                                </button>
                                            </div>
                                            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                                This color defines your event&apos;s primary buttons and accents.
                                            </p>
                                        </div>
                                    </div>
                                </div>


                                {/* Financials */}
                                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Fees</h3>
                                    <div>
                                        <label htmlFor="event-fee-bearer" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Who pays the fees?</label>
                                        <select
                                            id="event-fee-bearer"
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
                                            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        >
                                            <option value="customer">Customer pays</option>
                                            <option value="organizer">Organizer pays</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Customer paid fees appear at checkout. Organizer paid fees are deducted from your earnings.
                                        </p>
                                    </div>
                                    </div>

                                {/* Socials */}
                                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Social links</h3>
                                    <div className="grid gap-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Website
                                        <input
                                            disabled={isStaff}
                                            value={event.social_website || ''}
                                            onChange={e => setEvent({ ...event, social_website: e.target.value })}
                                            className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                            placeholder="Website URL"
                                        />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instagram
                                        <input
                                            disabled={isStaff}
                                            value={event.social_instagram || ''}
                                            onChange={e => setEvent({ ...event, social_instagram: e.target.value })}
                                            className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                            placeholder="Instagram Username"
                                        />
                                        </label>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">X
                                        <input
                                            disabled={isStaff}
                                            value={event.social_twitter || ''}
                                            onChange={e => setEvent({ ...event, social_twitter: e.target.value })}
                                            className="mt-1.5 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                            placeholder="Username"
                                        />
                                        </label>
                                    </div>
                                </div>

                                {/* Save action at the end of event settings */}
                                <div className="pt-2">
                                    {!isStaff ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => updateEvent()}
                                                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-black text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-white dark:text-black"
                                                disabled={loading}
                                            >
                                                {loading ? 'Saving...' : 'Save event'}
                                            </button>
                                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white/10">
                                                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                                    <h3 className="mb-2 text-base font-semibold text-gray-950 dark:text-white">Delete event</h3>
                                                    <p className="mb-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                                                        Deleting this event will permanently remove all associated data, including ticket sales and guest lists.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDeleteModalOpen(true)}
                                                        className="h-10 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 transition-colors hover:border-red-400 dark:border-red-500/30 dark:text-red-400"
                                                    >
                                                        Delete event
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                                            <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white">
                                                <ShieldCheck className="w-4 h-4" />
                                                View only
                                            </h3>
                                            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                                                Staff can view event details. Owners and admins can make changes.
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
                    <TicketsTab event={event} tiers={tiers} onTiersUpdate={setTiers} isStaff={isStaff} />
                )
            }

            {/* ADD-ONS TAB */}
            {activeTab === 'addons' && (
                <AddonsTab
                    addons={addons}
                    eventId={event.id}
                    organizationId={event.organization_id || ''}
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
                    <AttendeesTab event={event} isStaff={isStaff} />
                )
            }

            {/* DISCOUNTS TAB */}
            {
                activeTab === 'discounts' && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">Discount codes</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create offers and track how often they are used.</p>
                            </div>
                            <button type="button" onClick={() => showDiscountForm ? cancelEditingDiscount() : setShowDiscountForm(true)} aria-expanded={showDiscountForm} className={showDiscountForm ? "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#111] dark:text-gray-300 dark:hover:bg-white/10" : "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"}>
                                {showDiscountForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {showDiscountForm ? 'Close form' : 'Create code'}
                            </button>
                        </div>
                        {showDiscountForm && <div className="max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-950 dark:text-white">{editingDiscountId ? 'Edit discount code' : 'New discount code'}</h3>
                                {editingDiscountId && (
                                    <button
                                        onClick={cancelEditingDiscount}
                                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                                    >
                                        Cancel edit
                                    </button>
                                )}
                            </div>
                            <form onSubmit={handleSaveDiscount} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="md:col-span-1">
                                    <label htmlFor="discount-code" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Discount code</label>
                                    <input
                                        id="discount-code"
                                        required
                                        value={discountForm.code}
                                        onChange={e => setDiscountForm({ ...discountForm, code: e.target.value })}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium uppercase text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        placeholder="e.g. EARLYBIRD"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="discount-type" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Discount type</label>
                                    <div className="relative">
                                        <select
                                            id="discount-type"
                                            value={discountForm.type}
                                            onChange={e => setDiscountForm({ ...discountForm, type: e.target.value as 'percentage' | 'fixed' })}
                                            className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
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
                                    <label htmlFor="discount-value" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{discountForm.type === 'percentage' ? 'Percent off' : 'Amount off'}</label>
                                    <input
                                        id="discount-value"
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        max={discountForm.type === 'percentage' ? 100 : undefined}
                                        value={isNaN(discountForm.value) ? '' : discountForm.value}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value)
                                            setDiscountForm({ ...discountForm, value: isNaN(val) ? 0 : val })
                                        }}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                    />
                                </div>
                                <details className="md:col-span-3 rounded-xl border border-gray-200 dark:border-white/10">
                                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 [&::-webkit-details-marker]:hidden">Usage, expiry, and affiliate options</summary>
                                    <div className="grid grid-cols-1 gap-4 border-t border-gray-200 px-4 py-4 dark:border-white/10 md:grid-cols-3">
                                <div>
                                    <label htmlFor="discount-limit" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Usage limit</label>
                                    <input
                                        id="discount-limit"
                                        type="number"
                                        min="0"
                                        value={discountForm.max_uses}
                                        onChange={e => setDiscountForm({ ...discountForm, max_uses: parseInt(e.target.value) })}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        placeholder="∞"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Expires</label>
                                    <DateTimePicker
                                        date={discountForm.expires_at ? new Date(discountForm.expires_at) : undefined}
                                        setDate={(date) => setDiscountForm({ ...discountForm, expires_at: date ? date.toISOString() : '' })}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="discount-tier" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Ticket types</label>
                                    <div className="relative">
                                        <select
                                            id="discount-tier"
                                            value={discountForm.tier_id || ''}
                                            onChange={e => setDiscountForm({ ...discountForm, tier_id: e.target.value })}
                                            className="h-11 w-full appearance-none truncate rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        >
                                            <option value="">All ticket types</option>
                                            {tiers.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="discount-campaign" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Campaign key</label>
                                    <input
                                        id="discount-campaign"
                                        value={discountForm.linked_utm_campaign}
                                        onChange={e => setDiscountForm({ ...discountForm, linked_utm_campaign: e.target.value })}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        placeholder="e.g. summer_promo"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="discount-commission" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Promoter commission (%)</label>
                                    <input
                                        id="discount-commission"
                                        type="number"
                                        value={discountForm.affiliate_commission_percent}
                                        onChange={e => setDiscountForm({ ...discountForm, affiliate_commission_percent: parseFloat(e.target.value) })}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label htmlFor="discount-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Promoter email</label>
                                    <input
                                        id="discount-email"
                                        type="email"
                                        value={discountForm.affiliate_email}
                                        onChange={e => setDiscountForm({ ...discountForm, affiliate_email: e.target.value })}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        placeholder="promoter@email.com"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add an email to send this promoter sales notifications.</p>
                                </div>
                                    </div>
                                </details>
                                <div className="md:col-span-3 flex justify-end pt-2">
                                    <button
                                        disabled={creatingDiscount}
                                        className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-white dark:text-black"
                                    >
                                        {creatingDiscount ? 'Saving...' : (editingDiscountId ? 'Update code' : 'Create code')}
                                    </button>
                                </div>
                            </form>
                        </div>}

                        <div className="grid gap-4">
                            {discounts.slice(discountPage * 5, (discountPage + 1) * 5).map(discount => (
                                <div key={discount.id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#111] sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-base font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                            %
                                        </div>
                                        <div className="min-w-0">
                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <h4 className="break-all text-base font-semibold tracking-tight text-gray-950 dark:text-white">{discount.code}</h4>
                                                <button
                                                    onClick={() => copyCode(discount.code, discount.id)}
                                                    className="text-gray-400 hover:text-black dark:hover:text-white transition-colors p-1"
                                                    title="Copy Code"
                                                    aria-label={`Copy code ${discount.code}`}
                                                >
                                                    {copiedId === discount.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                                {discount.linked_utm_campaign && <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">Campaign: {discount.linked_utm_campaign}</span>}
                                                {discount.affiliate_email && <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">Promoter: {discount.affiliate_email} ({discount.affiliate_commission_percent}%)</span>}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                                                    <span className="font-medium text-gray-900 dark:text-white">{discount.type === 'percentage' ? `${discount.value}% off` : `${formatCurrency(discount.value, event.currency || 'GHS')} off`}</span>
                                                    <span aria-hidden="true">·</span>
                                                    <span>Used {discount.used_count || 0}{discount.max_uses ? ` of ${discount.max_uses}` : ' times'}</span>
                                                    <span aria-hidden="true">·</span>
                                                    <span>{discount.tier_id ? (tiers.find(t => t.id === discount.tier_id)?.name || 'Selected ticket type') : 'All ticket types'}</span>
                                                    {discount.expires_at && <span>Expires {new Date(discount.expires_at).toLocaleDateString()}</span>}
                                                </p>
                                                <button type="button" className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white" onClick={() => {
                                                    const link = `${window.location.origin}/events/${event.slug}?code=${discount.code}`;
                                                    navigator.clipboard.writeText(link);
                                                    toast.success('Checkout link copied');
                                                }}>
                                                    <Copy className="h-3.5 w-3.5" /> Copy checkout link
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2 border-t border-gray-100 pt-3 dark:border-white/10 sm:border-0 sm:pt-0">
                                        <button
                                            onClick={() => startEditingDiscount(discount)}
                                            className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 dark:border-white/10 dark:text-gray-300"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => deleteDiscount(discount.id)}
                                            className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-medium text-red-600 transition-colors hover:border-red-300 dark:border-white/10 dark:text-red-400"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {discounts.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-14 text-center text-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-gray-400">
                                    <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
                                        <span className="text-base font-semibold">%</span>
                                    </div>
                                    <p className="font-medium text-gray-900 dark:text-white">No discount codes yet</p>
                                    <p className="mt-1 text-sm">Create one to offer a promotion for this event.</p>
                                </div>
                            )}

                            {discounts.length > 5 && (
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#111]">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Showing <span className="font-medium">{discountPage * 5 + 1}</span> to <span className="font-medium">{Math.min((discountPage + 1) * 5, discounts.length)}</span> of <span className="font-medium">{discounts.length}</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDiscountPage(p => Math.max(0, p - 1))}
                                            disabled={discountPage === 0}
                                            className="px-4 py-2 bg-white dark:bg-[#111] dark:text-white border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDiscountPage(p => p + 1)}
                                            disabled={(discountPage + 1) * 5 >= discounts.length}
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



            {/* FORMS TAB */}
            {activeTab === 'forms' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                        <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">Questions and responses</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ask attendees for extra details after checkout.</p>
                            </div>
                            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5">
                                <button
                                    type="button"
                                    onClick={() => setFormsSubTab('builder')}
                                    aria-pressed={formsSubTab === 'builder'}
                                    className={clsx(
                                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                        formsSubTab === 'builder'
                                            ? "bg-white text-black dark:bg-white/10 dark:text-white"
                                            : "text-gray-500 hover:text-black dark:hover:text-white"
                                    )}
                                >
                                    Questions
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormsSubTab('responses');
                                        fetchResponses();
                                    }}
                                    aria-pressed={formsSubTab === 'responses'}
                                    className={clsx(
                                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                        formsSubTab === 'responses'
                                            ? "bg-white text-black dark:bg-white/10 dark:text-white"
                                            : "text-gray-500 hover:text-black dark:hover:text-white"
                                    )}
                                >
                                    Responses ({formResponses.length})
                                </button>
                            </div>
                        </div>

                        {formsSubTab === 'builder' && (
                            <div className="space-y-6">
                                {/* Form to create/edit question */}
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:p-5">
                                    <h3 className="mb-4 text-sm font-semibold text-gray-950 dark:text-white">
                                        {editingQuestionId ? 'Edit question' : 'Add a question'}
                                    </h3>
                                    <form onSubmit={handleSaveQuestion} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                <label htmlFor="question-label" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Question</label>
                                                <input
                                                    id="question-label"
                                                    required
                                                    value={questionForm.label}
                                                    onChange={e => setQuestionForm({ ...questionForm, label: e.target.value })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white"
                                                    placeholder="e.g. What is your T-shirt size?"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="question-type" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Answer type</label>
                                                <select
                                                    id="question-type"
                                                    value={questionForm.type}
                                                    onChange={e => setQuestionForm({ ...questionForm, type: e.target.value as 'text' | 'select' | 'checkbox' })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white"
                                                >
                                                    <option value="text">Free text</option>
                                                    <option value="select">Multiple choice</option>
                                                    <option value="checkbox">Yes or no</option>
                                                </select>
                                            </div>
                                        </div>

                                        {questionForm.type === 'select' && (
                                            <div>
                                                <label htmlFor="question-options" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Choices</label>
                                                <input
                                                    id="question-options"
                                                    required
                                                    value={questionForm.options}
                                                    onChange={e => setQuestionForm({ ...questionForm, options: e.target.value })}
                                                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white"
                                                    placeholder="e.g. Small, Medium, Large"
                                                />
                                                <span className="mt-1 block text-xs text-gray-500">Separate choices with commas.</span>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={questionForm.required}
                                                    onChange={e => setQuestionForm({ ...questionForm, required: e.target.checked })}
                                                    className="rounded border border-gray-200 bg-white checked:bg-black focus:ring-0 cursor-pointer"
                                                />
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Required</span>
                                            </label>
                                            <div className="flex gap-2">
                                                {editingQuestionId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingQuestionId(null);
                                                            setQuestionForm({ label: '', type: 'text', options: '', required: false });
                                                        }}
                                                    className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 dark:border-white/10 dark:text-gray-300"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={savingQuestion}
                                                    className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
                                                >
                                                    {savingQuestion ? 'Saving...' : (editingQuestionId ? 'Save question' : 'Add question')}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </div>

                                {/* Questions List */}
                                <div className="space-y-3">
                                    <h3 className="mb-2 text-sm font-semibold text-gray-950 dark:text-white">Saved questions</h3>
                                    {questions.map((q, idx) => (
                                        <div key={q.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#111] sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{q.label}</span>
                                                    {q.required && (
                                                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">Required</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    <span>{q.type === 'select' ? 'Multiple choice' : q.type === 'checkbox' ? 'Yes or no' : 'Free text'}</span>
                                                    {q.options && q.options.length > 0 && (
                                                        <span className="ml-2">· {q.options.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    onClick={() => handleMoveQuestion(idx, 'up')}
                                                    disabled={idx === 0}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-30"
                                                    title="Move Up"
                                                    aria-label={`Move ${q.label} up`}
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveQuestion(idx, 'down')}
                                                    disabled={idx === questions.length - 1}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-30"
                                                    title="Move Down"
                                                    aria-label={`Move ${q.label} down`}
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => startEditingQuestion(q)}
                                                    className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 dark:border-white/10 dark:text-gray-300"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                    title="Delete Question"
                                                    aria-label={`Delete ${q.label}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {questions.length === 0 && <p className="rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">No questions added yet.</p>}
                                </div>
                            </div>
                        )}

                        {formsSubTab === 'responses' && (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="relative w-full sm:w-72">
                                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search responses"
                                            aria-label="Search responses"
                                            value={responseSearchQuery}
                                            onChange={e => setResponseSearchQuery(e.target.value)}
                                            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        />
                                    </div>
                                    <button
                                        onClick={handleExportResponses}
                                        disabled={formResponses.length === 0}
                                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 sm:w-auto"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Export all
                                    </button>
                                </div>

                                <div className="space-y-2 md:hidden">
                                    {filteredFormResponses.map(r => (
                                        <div key={r.id} className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{r.event_form_questions?.label || 'Question'}</p>
                                            <p className="mt-1 break-words text-sm font-semibold text-gray-950 dark:text-white">{r.answer || '—'}</p>
                                            <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-gray-100 pt-3 text-xs dark:border-white/10">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-800 dark:text-gray-200">{r.reservations?.guest_name || 'Guest'}</p>
                                                    <p className="break-all text-gray-500 dark:text-gray-400">{r.reservations?.guest_email || '—'}</p>
                                                </div>
                                                <time className="shrink-0 text-gray-500 dark:text-gray-400" dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString()}</time>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredFormResponses.length === 0 && (
                                        <p className="rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                                            {responseSearchQuery ? 'No responses match your search.' : 'No responses yet.'}
                                        </p>
                                    )}
                                </div>

                                <div className="hidden overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 md:block">
                                    <table className="w-full min-w-[640px] text-left text-sm">
                                        <thead className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Attendee</th>
                                                <th className="px-4 py-3 font-medium">Question</th>
                                                <th className="px-4 py-3 font-medium">Answer</th>
                                                <th className="px-4 py-3 font-medium">Submitted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-white/5 text-gray-900 dark:text-white">
                                            {filteredFormResponses.map(r => (
                                                    <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{r.reservations?.guest_name || 'Guest'}</div>
                                                            <div className="text-xs text-gray-500">{r.reservations?.guest_email || '—'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                            {r.event_form_questions?.label}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                            {r.answer}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-500">
                                                            {new Date(r.created_at).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            {filteredFormResponses.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-12 text-center text-sm text-gray-500">
                                                        {responseSearchQuery ? 'No responses match your search.' : 'No responses yet.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TEAM TAB */}
            {
                activeTab === 'team' && (
                    <StaffTab eventId={event.id} isStaff={isStaff} />
                )
            }
        </div >
    )
}
