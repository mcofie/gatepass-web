'use client'

import React, { useState, useEffect } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
// Dynamic imports for heavy libraries
// import html2canvas from 'html2canvas'
// import jsPDF from 'jspdf'
// import confetti from 'canvas-confetti'
import { Event, TicketTier, Discount, PaymentPlan, EventAddon, EventFormQuestion } from '@/types/gatepass'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { ReceiptTicket } from '@/components/ticket/ReceiptTicket'
import { GatePassMark } from '@/components/branding/GatePassMark'

import { createReservation } from '@/utils/gatepass'
import { trackConversion } from '@/components/TrackingScripts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { toast } from 'sonner'
import { Globe, Calendar, CalendarClock, ChevronDown, ChevronUp, Check, ChevronRight, Share2, Clock, MapPin, Heart, BadgeCheck, Loader2, Download, ArrowLeft, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { calculateFees, FeeRates, getEffectiveFeeRates } from '@/utils/fees'
import { ReservationTimer, useReservationCountdown, type ReservationCountdown } from '@/components/checkout/ReservationTimer'
import { formatWebsiteUrl, formatInstagramUrl, formatTwitterUrl } from '@/utils/social'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface EventDetailClientProps {
    event: Event
    tiers: TicketTier[]
    isFeedItem?: boolean
    layoutId?: string
    feeRates?: FeeRates
    availableAddons?: any[] // Using any[] for now or safe EventAddon[]
}

// Simple Timer Hook
export function EventDetailClient({ event, tiers, isFeedItem = false, layoutId, feeRates, availableAddons = [] }: EventDetailClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const [view, setView] = useState<'details' | 'tickets' | 'addons' | 'checkout' | 'summary' | 'success'>('details')
    const [paymentMode, setPaymentMode] = useState<'full' | 'instalment'>('full')
    const [activePaymentPlan, setActivePaymentPlan] = useState<PaymentPlan | null>(null)

    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const prefersReducedMotion = useReducedMotion()
    const viewVariants = {
        enter: (navDirection: 'forward' | 'back') => ({ opacity: 0, x: prefersReducedMotion ? 0 : navDirection === 'forward' ? 8 : -8 }),
        center: { opacity: 1, x: 0 },
        exit: (navDirection: 'forward' | 'back') => ({ opacity: 0, x: prefersReducedMotion ? 0 : navDirection === 'forward' ? -8 : 8 }),
    }
    const viewTransition = { duration: prefersReducedMotion ? 0.01 : 0.18, ease: 'easeOut' as const }
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({})
    const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
    const [reservations, setReservations] = useState<any[]>([])
    const [purchasedTickets, setPurchasedTickets] = useState<any[]>([])

    // Discount State
    const [promoCode, setPromoCode] = useState('')
    const [discount, setDiscount] = useState<Discount | null>(null)
    const [discountError, setDiscountError] = useState('')
    const [applyingDiscount, setApplyingDiscount] = useState(false)

    // Modular Discount Application Logic
    const applyPromoCode = React.useCallback(async (codeOverride?: string, isAutoApply = false) => {
        const codeToUse = (typeof codeOverride === 'string' ? codeOverride : promoCode).trim().toUpperCase()
        if (!codeToUse) return

        if (!isAutoApply) setApplyingDiscount(true)
        setDiscountError('')
        if (!isAutoApply) setDiscount(null)

        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('discounts')
                .select('*')
                .eq('event_id', event.id)
                .eq('code', codeToUse)
                .maybeSingle()

            if (error || !data) {
                if (!isAutoApply) setDiscountError('Invalid promo code')
                return
            }

            // Check limits
            if (data.max_uses && data.used_count >= data.max_uses) {
                if (!isAutoApply) setDiscountError('This code has been fully redeemed')
                return
            }

            // Check Expiration
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                if (!isAutoApply) setDiscountError('Discount code has expired')
                return
            }

            // Check Tier Restriction (Only if not auto-applying from URL, or if we want to be strict)
            // If auto-applying, we set the discount but the memoized calculation handles 0 benefit until tier is added.
            if (data.tier_id && !isAutoApply) {
                const requiredTier = tiers.find(t => t.id === data.tier_id)
                const hasTierInCart = (selectedTickets[data.tier_id] || 0) > 0
                if (!hasTierInCart) {
                    setDiscountError(`This code is only valid for ${requiredTier?.name || 'specific'} tickets`)
                    return
                }
            }

            setDiscount(data as Discount)
            if (codeOverride) setPromoCode(codeToUse)

            // Update existing reservations if already at checkout
            if (reservations.length > 0) {
                const updatePromises = reservations.map(async (res) => {
                    if (data.tier_id && res.ticket_tier_id !== data.tier_id) return null
                    return supabase.rpc('apply_reservation_discount', {
                        p_reservation_id: res.id,
                        p_discount_code: codeToUse
                    })
                })
                await Promise.all(updatePromises)
            }

            if (!isAutoApply) toast.success('Discount applied!')
        } catch (e) {
            if (!isAutoApply) setDiscountError('Failed to verify code')
        } finally {
            if (!isAutoApply) setApplyingDiscount(false)
        }
    }, [promoCode, event.id, tiers, selectedTickets, reservations, supabase])

    // Track View Count & UTM Marketing
    useEffect(() => {
        if (!isFeedItem) {
            // Skip incrementing views for previews
            if (event.id === 'preview-id') return

            // 1. Standard View Count
            supabase.rpc('increment_event_view', { event_id: event.id })
                .then(({ error }) => {
                    if (error) console.error('Error incrementing view count:', error.message || error)
                })

            // 2. Marketing Tracking (UTM or Direct Discount Code)
            const utm_source = searchParams.get('utm_source')
            const urlCode = searchParams.get('code')

            if (utm_source || urlCode) {
                const effectiveSource = utm_source || 'affiliate_direct'
                const effectiveCampaign = searchParams.get('utm_campaign') || urlCode || 'organic_promo'
                const effectiveMedium = searchParams.get('utm_medium') || (urlCode ? 'referral' : 'social')

                supabase.schema('gatepass').rpc('track_marketing_event', {
                    p_event_id: event.id,
                    p_utm_source: effectiveSource,
                    p_utm_medium: effectiveMedium,
                    p_utm_campaign: effectiveCampaign,
                    p_event_type: 'view'
                }).then(({ error }) => {
                    if (error) console.error('Error tracking marketing event:', error.message || error)
                })

                // Auto-Apply Logic
                if (urlCode && urlCode.toUpperCase() !== promoCode) {
                    applyPromoCode(urlCode, true)
                } else if (searchParams.get('utm_campaign') && !promoCode) {
                    // Auto-Apply Discount linked to UTM campaign if no direct code parameter
                    supabase.schema('gatepass').from('discounts')
                        .select('code')
                        .eq('event_id', event.id)
                        .eq('linked_utm_campaign', searchParams.get('utm_campaign'))
                        .maybeSingle()
                        .then(({ data }) => {
                            if (data?.code) {
                                applyPromoCode(data.code, true)
                            }
                        })
                }
            }

        }
    }, [event.id, isFeedItem, searchParams, supabase, applyPromoCode])

    // Filter addons: only show general addons or ones tied to currently selected ticket tiers
    const activeTierIds = Object.keys(selectedTickets).filter(tierId => selectedTickets[tierId] > 0)
    const filteredAddons = availableAddons.filter(addon => {
        return !addon.tier_id || activeTierIds.includes(addon.tier_id)
    })

    // Cleanup addons if their required tier is no longer in selectedTickets
    useEffect(() => {
        const activeTiers = Object.keys(selectedTickets).filter(tierId => selectedTickets[tierId] > 0)
        setSelectedAddons(prev => {
            let changed = false
            const next = { ...prev }
            for (const addonId of Object.keys(next)) {
                const addon = availableAddons.find(a => a.id === addonId)
                if (addon?.tier_id && !activeTiers.includes(addon.tier_id)) {
                    delete next[addonId]
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [selectedTickets, availableAddons])

    // Mobile Expansion State
    const [isExpanded, setIsExpanded] = useState(false)

    // Navigation Helper
    const navigate = (newView: typeof view, dir: 'forward' | 'back' = 'forward') => {
        setDirection(dir)
        setView(newView)
        // Auto-expand on navigation to deeper views
        if (newView !== 'details') setIsExpanded(true)

        // Auto-select first addon if none selected when moving to addons
        if (newView === 'addons' && Object.keys(selectedAddons).length === 0 && filteredAddons.length > 0) {
            setSelectedAddons({ [filteredAddons[0].id]: 1 })
        }

        // Track Checkout Initiated
        if (newView === 'checkout' && dir === 'forward') {
            const utm_source = searchParams.get('utm_source')
            if (utm_source) {
                supabase.schema('gatepass').rpc('track_marketing_event', {
                    p_event_id: event.id,
                    p_utm_source: utm_source,
                    p_utm_medium: searchParams.get('utm_medium'),
                    p_utm_campaign: searchParams.get('utm_campaign'),
                    p_event_type: 'checkout'
                })
            }
        }
    }

    // Form State
    const [guestName, setGuestName] = useState('')
    const [guestEmail, setGuestEmail] = useState('')
    const [guestPhone, setGuestPhone] = useState('')

    const countdown = useReservationCountdown(reservations[0]?.expires_at)

    // Handle Payment Callback (Redirect Flow)
    useEffect(() => {
        const reference = searchParams.get('reference') || searchParams.get('trxref')
        // Scope verification to THIS event instance
        const callbackEventId = searchParams.get('event_id')

        if (reference) {
            if (callbackEventId && callbackEventId !== event.id) {
                return
            }

            const verifyPayment = async () => {
                setVerifying(true)
                try {
                    const response = await fetch('/api/payments/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference })
                    })
                    const result = await response.json()

                    window.history.replaceState({}, '', window.location.pathname)

                    if (!result.success) throw new Error(result.error || 'Verification failed')

                    const tickets = result.tickets || []
                    setPurchasedTickets(tickets)

                    // Track Conversion (Meta Pixel & GA4)
                    try {
                        const totalAmount = tickets.reduce((acc: number, t: any) => acc + (t.amount || 0), 0)
                        const currency = tickets[0]?.currency || 'GHS'
                        if (totalAmount > 0) {
                            trackConversion(totalAmount, currency, tickets[0]?.id || reference)
                        }
                    } catch (err) {
                        console.error('Tracking Error:', err)
                    }

                    navigate('success', 'forward')
                } catch (error: any) {
                    console.error('Verification Error:', error)
                    toast.error(error.message || 'Payment verification failed')
                } finally {
                    setVerifying(false)
                }
            }
            verifyPayment()
        }
    }, [searchParams, event.id])

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user && !user.is_anonymous) {
                const { data: profile } = await supabase.schema('gatepass').from('profiles').select('*').eq('id', user.id).single()
                if (profile) {
                    setGuestName(profile.full_name || '')
                    setGuestEmail(profile.email || user.email || '')
                    setGuestPhone(profile.phone_number || '')
                }
            }
        }
        checkUser()
    }, [])

    const handleQuantityChange = (tierId: string, delta: number) => {
        setSelectedTickets(prev => {
            const current = prev[tierId] || 0
            const intent = current + delta
            if (intent < 0) return prev

            const tier = tiers.find(t => t.id === tierId)
            if (tier?.is_virtual && intent > 1) {
                toast.error('Virtual / Remote access tickets are limited to 1 per order')
                return prev
            }
            if (tier?.max_per_order && intent > tier.max_per_order) {
                toast.error(`Limit of ${tier.max_per_order} tickets per order`)
                return prev
            }
            if (tier && (tier.quantity_sold + intent) > tier.total_quantity) {
                toast.error('Not enough tickets available')
                return prev
            }

            return { ...prev, [tierId]: intent }
        })
    }

    const handleAddonQuantityChange = (addonId: string, delta: number) => {
        setSelectedAddons(prev => {
            const current = prev[addonId] || 0
            const addon = filteredAddons.find(a => a.id === addonId)

            if (!addon) return prev

            const intent = current + delta
            if (intent < 0) return prev

            // Check inventory limit
            if (addon.total_quantity !== null && addon.total_quantity !== undefined) {
                const remaining = Math.max(0, addon.total_quantity - addon.quantity_sold)
                if (intent > remaining) return prev
            }

            return { ...prev, [addonId]: intent }
        })
    }

    // 1. Calculate Ticket Only Subtotal
    const ticketSubtotal = React.useMemo(() => {
        let total = 0
        Object.entries(selectedTickets).forEach(([tierId, qty]) => {
            const tier = tiers.find(t => t.id === tierId)
            if (tier) {
                let tierSubtotal = tier.price * qty
                if (tier.min_quantity && qty >= tier.min_quantity && tier.discount_value) {
                    const discountValue = tier.discount_value || 0
                    if (tier.discount_type === 'percentage') {
                        tierSubtotal = tierSubtotal - (tierSubtotal * (discountValue / 100))
                    } else if (tier.discount_type === 'fixed') {
                        tierSubtotal = Math.max(0, tierSubtotal - discountValue)
                    }
                }
                total += tierSubtotal
            }
        })
        return total
    }, [selectedTickets, tiers])

    // 2. Calculate Addon Subtotal
    const addonSubtotal = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
        const addon = filteredAddons.find(a => a.id === id)
        return sum + ((addon?.price || 0) * qty)
    }, 0)

    // 3. Discount Calculation (Coupon Code)
    const discountAmount = React.useMemo(() => {
        if (!discount) return 0

        // Default target is Ticket Subtotal (not including addons usually)
        let targetAmount = ticketSubtotal

        // If Tier Specific, filter only relevant amount
        if (discount.tier_id) {
            const qty = selectedTickets[discount.tier_id] || 0
            const tier = tiers.find(t => t.id === discount.tier_id)
            if (!tier || qty === 0) return 0
            
            let tierSubtotal = tier.price * qty
            if (tier.min_quantity && qty >= tier.min_quantity && tier.discount_value) {
                const discountValue = tier.discount_value || 0
                if (tier.discount_type === 'percentage') {
                    tierSubtotal = tierSubtotal - (tierSubtotal * (discountValue / 100))
                } else if (tier.discount_type === 'fixed') {
                    tierSubtotal = Math.max(0, tierSubtotal - discountValue)
                }
            }
            targetAmount = tierSubtotal
        }

        return discount.type === 'fixed'
            ? discount.value
            : (targetAmount * (discount.value / 100))
    }, [discount, ticketSubtotal, selectedTickets, tiers])

    const netTicketSubtotal = Math.max(0, ticketSubtotal - discountAmount)

    // Use effective rates for THIS event
    const effectiveRates = getEffectiveFeeRates(feeRates, event)
    const { clientFees, customerTotal } = calculateFees(
        netTicketSubtotal,
        addonSubtotal,
        event.fee_bearer as 'customer' | 'organizer',
        effectiveRates
    )
    const platformFees = clientFees
    const totalDue = customerTotal

    // Helper for creating reservation payload (Total Amount validation)
    const calculatedTotal = ticketSubtotal + addonSubtotal

    const handleContinueToCheckout = () => {
        if (filteredAddons && filteredAddons.length > 0) {
            navigate('addons', 'forward')
        } else {
            navigate('checkout', 'forward')
        }
    }

    // Step 1: Create Reservation (Invoked on "Continue to Payment")
    const handleCreateReservation = async () => {
        setLoading(true)
        try {
            let userId: string | null = null

            // robust user check
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                userId = session.user.id
            } else {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) userId = user.id
            }

            console.log('[EventDetail] Creating reservation for User:', userId)

            if (userId) {
                // Double check binding? No, passed explicit.
            }

            // 2. Identify all selected tiers
            const tiersToBook = Object.entries(selectedTickets)
                .filter(([_, qty]) => qty > 0)
                .map(([tierId, qty]) => ({ tierId, qty }))

            if (tiersToBook.length === 0) throw new Error('No tickets selected')

            console.log('Creating Reservations for:', tiersToBook)

            // 3. Create Reservations in Parallel
            // Note: We only attach add-ons to the FIRST reservation to avoid duplicating cost/inventory.
            // Or we should split them? Ideally logic should be: Add-ons are per Event invocation,
            // but `createReservation` utility might attach them to the specific row.
            // If we assume Add-ons are 1-time purchase for the whole groups, we attach to first.

            const createdDocs = await Promise.all(tiersToBook.map(async (item, index) => {
                const isFirst = index === 0
                // Only attach add-ons to the first reservation in the batch
                const addonsPayload = isFirst ? selectedAddons : {}

                return createReservation(
                    event.id,
                    item.tierId,
                    userId,
                    item.qty,
                    supabase,
                    {
                        email: guestEmail,
                        name: guestName,
                        phone: guestPhone
                    },
                    discount?.id,
                    addonsPayload,
                    {
                        utm_source: searchParams.get('utm_source'),
                        utm_medium: searchParams.get('utm_medium'),
                        utm_campaign: searchParams.get('utm_campaign')
                    }
                )
            }))

            const validDocs = createdDocs.filter(d => d && d.id)
            if (validDocs.length === 0) throw new Error('Failed to create reservations')

            setReservations(validDocs)
            navigate('summary', 'forward')

        } catch (error: any) {
            console.error('Reservation Error:', error)
            toast.error(error.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Payment (Invoked on "Pay Now")
    const handlePaystackPayment = async () => {
        if (reservations.length === 0) {
            toast.error('No active reservation found. Please try again.')
            return
        }

        setLoading(true)
        const primaryTierId = reservations[0].ticket_tier_id
        const selectedTier = tiers.find(t => t.id === primaryTierId)

        try {
            // Check Sync for Discounts (Simple Loop)
            if (discount) {
                for (const res of reservations) {
                    if (res.discount_id !== discount.id) {
                        if (discount.tier_id && res.ticket_tier_id !== discount.tier_id) continue

                        await supabase.rpc('apply_reservation_discount', {
                            p_reservation_id: res.id,
                            p_discount_code: promoCode
                        })
                    }
                }
            }

            // Call Initialize API (Gateway-agnostic)
            const response = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: guestEmail || 'customer@gatepass.com',
                    phone: guestPhone || undefined,
                    amount: Math.round(totalDue * 100),
                    currency: selectedTier?.currency || 'GHS',
                    reservationIds: reservations.map(r => r.id), // Pass Array
                    callbackUrl: `${window.location.protocol}//${window.location.host}${window.location.pathname}?event_id=${event.id}`
                })
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Payment initialization failed')

            // Redirect to payment gateway
            window.location.href = data.authorization_url

        } catch (error: any) {
            console.error('Payment Error:', error)
            toast.error(error.message)
            setLoading(false)
        }
    }

    // Step 2b: Instalment Payment (First instalment only)
    // Instalment: order value = tickets + addons - discount (fees excluded, they're per-transaction)
    const orderValue = netTicketSubtotal + addonSubtotal

    const handleInstalmentPayment = async () => {
        if (reservations.length === 0 || !activePaymentPlan) {
            toast.error('No reservation or payment plan found.')
            return
        }

        setLoading(true)
        const primaryRes = reservations[0]
        const selectedTier = tiers.find(t => t.id === primaryRes.ticket_tier_id || t.id === primaryRes.tier_id)

        // Calculate first instalment: split the ORDER VALUE (tickets + addons), not totalDue
        const initialPercent = activePaymentPlan.initial_percent || 50
        const firstInstalmentOrderShare = Math.round(orderValue * initialPercent / 100 * 100) / 100


        try {
            const response = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: guestEmail || 'customer@gatepass.com',
                    amount: Math.round(firstInstalmentOrderShare * 100),
                    currency: selectedTier?.currency || 'GHS',
                    phone: guestPhone || undefined,
                    reservationIds: [primaryRes.id],
                    // Marks this as a deposit so the webhook and /verify never issue full tickets for it
                    metadata: { payment_type: 'instalment_first', payment_plan_id: activePaymentPlan.id },
                    callbackUrl: `${window.location.protocol}//${window.location.host}/my-tickets/instalments/callback?event_id=${event.id}&plan_id=${activePaymentPlan.id}&reservation_id=${primaryRes.id}`
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Payment initialization failed')

            window.location.href = data.authorization_url
        } catch (error: any) {
            console.error('Instalment Payment Error:', error)
            toast.error(error.message)
            setLoading(false)
        }
    }

    // Detect if any selected tier has instalment plans
    const availableInstalmentPlans = React.useMemo(() => {
        const plans: PaymentPlan[] = []
        const activeTiers = Object.keys(selectedTickets).filter(tierId => selectedTickets[tierId] > 0)

        // Gap Fix: Prevent multi-tier checkout for instalments.
        // It's too complex to link multiple payment plans to a single Paystack reference.
        if (activeTiers.length !== 1) {
            return []
        }

        const tierId = activeTiers[0]
        const tier = tiers.find(t => t.id === tierId)
        if (tier?.allow_instalments && tier.payment_plans && tier.payment_plans.length > 0) {
            const activePlan = tier.payment_plans.find((p: any) => p.is_active)
            if (activePlan) plans.push(activePlan)
        }

        return plans
    }, [selectedTickets, tiers])

    const hasMultiTierInstalmentConflict = React.useMemo(() => {
        const activeTiers = Object.keys(selectedTickets).filter(tierId => selectedTickets[tierId] > 0)
        if (activeTiers.length <= 1) return false

        return activeTiers.some(tierId => {
            const tier = tiers.find(t => t.id === tierId)
            return tier?.allow_instalments && tier.payment_plans && tier.payment_plans.length > 0
        })
    }, [selectedTickets, tiers])


    const hasTicketsSelected = Object.values(selectedTickets).some(q => q > 0)
    const availableTiers = tiers.filter(tier => tier.quantity_sold < tier.total_quantity)
    const priceTiers = availableTiers.length > 0 ? availableTiers : tiers
    const cheapestTier = priceTiers.length > 0
        ? priceTiers.reduce((cheapest, tier) => tier.price < cheapest.price ? tier : cheapest)
        : null
    const isModalExpanded = view !== 'details'

    // Mobile Expansion Logic
    const expandCard = () => {
        if (view === 'details' && !isExpanded) {
            // Haptic Feedback
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(10) // Taptic-like light impact
            }
            setIsExpanded(true)
        }
    }

    const cardHeightClass = (view === 'details' && !isExpanded)
        ? 'max-h-[148px]'
        : 'max-h-[85vh]'     // Expanded height

    if (verifying) {
        return (
            // Full Screen Verification Loader
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fade-in">
                <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin mb-4" />
                <h2 className="text-xl font-bold tracking-tight text-black">Verifying Payment</h2>
                <p className="text-sm text-gray-500 mt-2">Securing your ticket...</p>
            </div>
        )
    }

    if (loading && view === 'details') {
        return <EventCardSkeleton />
    }

    if (loading && view !== 'details' && view !== 'summary' && view !== 'checkout') {
        return (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-black/10 border-t-black rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <>

            {/* Focus Mode Backdrop: Dims background when card is expanded or deeper views are active */}
            {(isModalExpanded || isExpanded) && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
                    onClick={() => {
                        if (view === 'success') {
                            navigate('details', 'back')
                            setIsExpanded(false)
                        }
                        else if (view !== 'details') navigate('details', 'back')
                        else setIsExpanded(false) // Dismiss focus mode on mobile
                    }}
                />
            )}

            {/* Floating Card / Modal Container */}
            <motion.div
                layoutId={layoutId}
                onClick={expandCard}
                style={{ WebkitTapHighlightColor: 'transparent' }} // Remove Android/iOS blue tap highlight
                className={`
                ${(isFeedItem && view !== 'success') ? 'absolute cursor-pointer active:scale-[0.98] hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-white/10' : 'fixed'} ${view === 'success' ? 'z-[100]' : 'z-50'} bg-white dark:bg-zinc-900 text-black dark:text-white shadow-2xl ${(view === 'details' || view === 'success') ? 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]' : ''} font-sans select-none
                bottom-4 left-4 right-4 
                mb-[env(safe-area-inset-bottom)]
                rounded-[28px] flex flex-col ${(view === 'details' && !isExpanded) || view === 'summary' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'}
                ${cardHeightClass}
                md:translate-x-0 md:translate-y-0 md:top-auto md:left-auto md:w-[360px] md:mb-0 md:max-h-[85vh]
                md:bottom-12 md:right-12 p-4
                border border-transparent dark:border-zinc-800
                ${view === 'success' ? 'md:bottom-8 md:right-8 md:w-[380px]' : ''}
                ${(view === 'details' && !isExpanded) ? 'cursor-pointer active:scale-[0.98]' : ''}
            `}>
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                {view === 'details' && (
                    <motion.div key="details" className="h-full" custom={direction} variants={viewVariants} initial={prefersReducedMotion ? false : 'enter'} animate="center" exit="exit" transition={viewTransition}>
                        {!isExpanded && <EventMobilePreview event={event} cheapestTier={cheapestTier} onExpand={expandCard} />}
                        <div className={!isExpanded ? 'hidden md:block' : 'block'}>
                            <DetailsView
                                event={event}
                                cheapestTier={cheapestTier}
                                hasPartPay={tiers.some(tier => tier.allow_instalments && tier.payment_plans?.some(plan => plan.is_active))}
                                onGetTickets={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    navigate('tickets', 'forward')
                                }}
                                isExpanded={isExpanded}
                                isFeedItem={isFeedItem}
                            />
                        </div>
                    </motion.div>
                )}
                {view === 'tickets' && (
                    <motion.div key="tickets" className="h-full" custom={direction} variants={viewVariants} initial={prefersReducedMotion ? false : 'enter'} animate="center" exit="exit" transition={viewTransition}>
                        <TicketsView
                            tiers={tiers}
                            selectedTickets={selectedTickets}
                            onQuantityChange={handleQuantityChange}
                            onContinue={handleContinueToCheckout}
                            onBack={() => navigate('details', 'back')}
                            total={calculatedTotal}
                            hasSelection={hasTicketsSelected}
                        />
                    </motion.div>
                )}
                {view === 'addons' && (
                    <motion.div key="addons" className="h-full" custom={direction} variants={viewVariants} initial={prefersReducedMotion ? false : 'enter'} animate="center" exit="exit" transition={viewTransition}>
                        <AddonsView
                            availableAddons={filteredAddons}
                            selectedAddons={selectedAddons}
                            onAddonChange={handleAddonQuantityChange}
                            onContinue={() => navigate('checkout', 'forward')}
                            onBack={() => navigate('tickets', 'back')}
                        />
                    </motion.div>
                )}
                {view === 'checkout' && (
                    <motion.div key="checkout" className="h-full" custom={direction} variants={viewVariants} initial={prefersReducedMotion ? false : 'enter'} animate="center" exit="exit" transition={viewTransition}>
                        <CheckoutFormView
                            guestName={guestName} setGuestName={setGuestName}
                            guestEmail={guestEmail} setGuestEmail={setGuestEmail}
                            guestPhone={guestPhone} setGuestPhone={setGuestPhone}
                            onBack={() => {
                                if (filteredAddons && filteredAddons.length > 0) {
                                    navigate('addons', 'back')
                                } else {
                                    navigate('tickets', 'back')
                                }
                            }}
                            onContinue={handleCreateReservation}
                            loading={loading}
                            hasTicketsSelected={hasTicketsSelected}
                        />
                    </motion.div>
                )}
                {view === 'summary' && (
                    <motion.div key="summary" className="flex-1 min-h-0 flex flex-col h-full" custom={direction} variants={viewVariants} initial={prefersReducedMotion ? false : 'enter'} animate="center" exit="exit" transition={viewTransition}>
                        <SummaryView
                            event={event}
                            tiers={tiers}
                            selectedTickets={selectedTickets}
                            subtotal={ticketSubtotal}
                            fees={platformFees}
                            total={totalDue}
                            countdown={countdown}
                            onRestart={() => {
                                // The hold lapsed: drop the stale reservations and pick tickets again
                                setReservations([])
                                navigate('tickets', 'back')
                            }}
                            loading={loading}
                            onBack={() => navigate('checkout', 'back')}
                            onPay={paymentMode === 'instalment' ? handleInstalmentPayment : handlePaystackPayment}
                            promoCode={promoCode}
                            setPromoCode={setPromoCode}
                            onApplyDiscount={applyPromoCode}
                            discount={discount}
                            discountError={discountError}
                            applyingDiscount={applyingDiscount}
                            availableAddons={filteredAddons}
                            selectedAddons={selectedAddons}
                            addonSubtotal={addonSubtotal}
                            instalmentPlans={availableInstalmentPlans}
                            paymentMode={paymentMode}
                            onPaymentModeChange={(mode, plan) => {
                                setPaymentMode(mode)
                                setActivePaymentPlan(plan || null)
                            }}
                            effectiveRates={effectiveRates}
                            feeBearer={event.fee_bearer as 'customer' | 'organizer'}
                            hasMultiTierInstalmentConflict={hasMultiTierInstalmentConflict}
                        />
                    </motion.div>
                )}
                {view === 'success' && purchasedTickets.length > 0 && (
                    <motion.div key="success" className="h-full" custom={direction} variants={viewVariants} initial={prefersReducedMotion ? false : 'enter'} animate="center" exit="exit" transition={viewTransition}>
                        <SuccessView
                            event={event}
                            tickets={purchasedTickets}
                            tierName={tiers.find(t => t.id === purchasedTickets[0].tier_id)?.name}
                            onClose={() => {
                                navigate('details', 'back')
                                setIsExpanded(false)
                            }}
                        />
                    </motion.div>
                )}
                </AnimatePresence>

            </motion.div>
        </>
    )
}

// Sub-components

const EventMobilePreview = ({ event, cheapestTier, onExpand }: { event: Event, cheapestTier: TicketTier | null, onExpand: () => void }) => {
    const startDate = new Date(event.starts_at)
    const endDate = event.ends_at ? new Date(event.ends_at) : null
    const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dateLabel = endDate && startDate.toDateString() !== endDate.toDateString()
        ? startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
            ? `${startLabel}–${endDate.getDate()}`
            : `${startLabel}–${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : startLabel
    const venueLabel = event.venue_name || event.venue_address || 'Location to be announced'

    return (
        <div className="md:hidden">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                        {event.logo_url ? (
                            <Image src={event.logo_url} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                            <span className="flex h-full items-center justify-center text-[10px] font-semibold text-gray-500">{event.title?.substring(0, 2).toUpperCase() || 'GP'}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-[16px] font-semibold leading-tight tracking-[-0.03em] text-black dark:text-white line-clamp-2">{event.title}</h2>
                        <p className="text-[12px] leading-tight text-gray-500 dark:text-gray-400 truncate mt-0.5">{event.organizers?.name || 'GatePass Event'}</p>
                    </div>
                </div>
                {cheapestTier && (
                    <div className="flex-shrink-0 text-right">
                        <span className="block text-[10px] leading-none text-gray-500 dark:text-gray-400">From</span>
                        <span className="block mt-0.5 text-[16px] leading-tight font-semibold tracking-tight text-black dark:text-white tabular-nums">{formatCurrency(cheapestTier.price, cheapestTier.currency)}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between gap-3 mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-800">
                <span className="min-w-0 truncate text-[11px] text-gray-500 dark:text-gray-400">{dateLabel} · {venueLabel}</span>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onExpand() }}
                    aria-label={`View details for ${event.title}`}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-black dark:text-white rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                >
                    View details <ChevronUp aria-hidden="true" className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}

const DetailsView = ({ event, cheapestTier, hasPartPay, onGetTickets, isExpanded, isFeedItem }: { event: Event, cheapestTier: TicketTier | null, hasPartPay: boolean, onGetTickets: (e: any) => void, isExpanded: boolean, isFeedItem?: boolean }) => {
    const [activeSlide, setActiveSlide] = useState<'description' | 'host' | 'lineup'>('description')
    const [showFullDescription, setShowFullDescription] = useState(false)
    const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')
    const descriptionRef = React.useRef<HTMLDivElement>(null)
    const hostInfoRef = React.useRef<HTMLDivElement>(null)
    const lineupRef = React.useRef<HTMLDivElement>(null)
    const descriptionText = (event.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const canExpandDescription = descriptionText.length > 145
    const startDate = new Date(event.starts_at)
    const endDate = event.ends_at ? new Date(event.ends_at) : null
    const sameDay = endDate !== null && startDate.toDateString() === endDate.toDateString()
    const sameMonth = endDate !== null && startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
    const sameYear = endDate !== null && startDate.getFullYear() === endDate.getFullYear()
    const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const time = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
    const dateLabel = !endDate || sameDay
        ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : sameMonth
            ? `${shortDate(startDate)}–${endDate.getDate()}, ${startDate.getFullYear()}`
            : sameYear
                ? `${shortDate(startDate)} – ${shortDate(endDate)}, ${startDate.getFullYear()}`
                : `${shortDate(startDate)}, ${startDate.getFullYear()} – ${shortDate(endDate)}, ${endDate.getFullYear()}`
    const timeLabel = !endDate
        ? time(startDate)
        : sameDay
            ? `${time(startDate)} – ${time(endDate)}`
            : `${startDate.toLocaleDateString('en-US', { weekday: 'short' })} ${time(startDate)} – ${endDate.toLocaleDateString('en-US', { weekday: 'short' })} ${time(endDate)}`

    // Dynamic Height Calculation
    useEffect(() => {
        const updateHeight = () => {
            let target = descriptionRef.current
            if (activeSlide === 'host') target = hostInfoRef.current
            if (activeSlide === 'lineup') target = lineupRef.current

            if (target) {
                // Use scrollHeight to capture full content including potential overflow/clamping
                // Add a small buffer (4px) to prevent sub-pixel cutting
                setContentHeight(target.scrollHeight + 4)
            }
        }

        updateHeight()

        // Robust ResizeObserver instead of just window resize
        const observer = new ResizeObserver(updateHeight)
        if (descriptionRef.current) observer.observe(descriptionRef.current)
        if (hostInfoRef.current) observer.observe(hostInfoRef.current)
        if (lineupRef.current) observer.observe(lineupRef.current)

        return () => observer.disconnect()
    }, [activeSlide, event.description, isExpanded, showFullDescription])

    return (
        <div className="animate-fade-in flex flex-col">
            {/* Header: Logo, Title, Host Name + Toggle, Price */}
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Organizer Logo */}
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 border border-gray-100 dark:border-zinc-700 relative">
                        {event.logo_url ? (
                            <Image src={event.logo_url} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                            <span className="text-[10px]">{event.title?.substring(0, 2).toUpperCase() || 'GP'}</span>
                        )}
                    </div>

                    {/* Title & Host Toggle */}
                    <div className="min-w-0">
                        <h2 className="text-[18px] font-semibold text-black dark:text-white leading-[1.12] tracking-[-0.035em] mb-1">{event.title}</h2>

                        {/* Interactive Host Name */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlide(activeSlide === 'host' ? 'description' : 'host');
                            }}
                            className="flex items-center gap-0.5 group outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-sm"
                            aria-label={`About ${event.organizers?.name || 'the organizer'}`}
                            aria-expanded={activeSlide === 'host'}
                        >
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">
                                {event.organizers?.name || 'GatePass Event'}
                            </p>
                            <ChevronRight
                                className={`w-3.5 h-3.5 text-gray-400 group-hover:text-black dark:group-hover:text-white transition-transform duration-300 ${activeSlide === 'host' ? 'rotate-90' : ''}`}
                            />
                        </button>
                    </div>
                </div>
                {cheapestTier && (
                    <div className="text-right flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-none">From</span>
                        <span className="block text-[17px] font-semibold tracking-tight text-black dark:text-white leading-tight">
                            {formatCurrency(cheapestTier.price, cheapestTier.currency)}
                        </span>
                        {hasPartPay && (
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Part-pay available</span>
                        )}
                    </div>
                )}
            </div>

            {/* Sliding Content Container */}
            <div className="overflow-hidden">
                <div
                    className="relative overflow-hidden w-full transition-[height] duration-300 ease-out motion-reduce:transition-none"
                    style={{ height: contentHeight === 'auto' ? 'auto' : `${contentHeight}px` }}
                >
                    <div
                        className="flex transition-transform duration-300 ease-out motion-reduce:transition-none w-[200%] items-start"
                        style={{ transform: activeSlide !== 'description' ? 'translateX(-50%)' : 'translateX(0)' }}
                    >
                        <div className="w-1/2 pr-4" ref={descriptionRef} aria-hidden={activeSlide !== 'description'} inert={activeSlide !== 'description'}>
                            {descriptionText && (
                                <div className="pt-5 pb-4">
                                    <div
                                        className={`text-[13px] font-normal text-gray-700 dark:text-gray-300 leading-[1.5] prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 [&_p+p]:mt-2 ${canExpandDescription && !showFullDescription ? 'line-clamp-3 overflow-hidden' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description || '') }}
                                    />
                                    {canExpandDescription && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setShowFullDescription(value => !value) }}
                                            className={`${!isExpanded ? 'hidden md:inline-flex' : 'inline-flex'} mt-2 text-[12px] font-semibold text-black dark:text-white underline underline-offset-4 decoration-gray-300 dark:decoration-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-sm`}
                                            aria-expanded={showFullDescription}
                                        >
                                            {showFullDescription ? 'Show less' : 'Read full description'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Organizer and lineup details share the second panel. */}
                        <div className="w-1/2 pl-1 pr-4" aria-hidden={activeSlide === 'description'} inert={activeSlide === 'description'}>
                            {activeSlide === 'host' && (
                                <div ref={hostInfoRef} className="pt-5 pb-4 animate-fade-in">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-[12px] font-semibold text-black dark:text-white">About the organizer</h3>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setActiveSlide('description') }}
                                            className="text-[11px] font-medium text-gray-500 hover:text-black dark:hover:text-white flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-sm"
                                        >
                                            <ArrowLeft className="w-3 h-3" /> Overview
                                        </button>
                                    </div>
                                    <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                                        {event.organizers?.description || 'No bio available.'}
                                    </p>

                                    {event.organizers && (
                                        <div className="flex items-center gap-3">
                                            {formatWebsiteUrl(event.organizers.website) && (
                                                <a href={formatWebsiteUrl(event.organizers.website)!} target="_blank" rel="noopener noreferrer" aria-label="Organizer website" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                                                    <Globe className="w-4 h-4" />
                                                </a>
                                            )}
                                            {formatInstagramUrl(event.organizers.instagram) && (
                                                <a href={formatInstagramUrl(event.organizers.instagram)!} target="_blank" rel="noopener noreferrer" aria-label="Organizer Instagram" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2" /></svg>
                                                </a>
                                            )}
                                            {formatTwitterUrl(event.organizers.twitter) && (
                                                <a href={formatTwitterUrl(event.organizers.twitter)!} target="_blank" rel="noopener noreferrer" aria-label="Organizer X profile" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSlide === 'lineup' && (
                                <div ref={lineupRef} className="pt-5 pb-4 animate-fade-in">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-[12px] font-semibold text-black dark:text-white">Lineup</h3>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setActiveSlide('description') }}
                                            className="text-[11px] font-medium text-gray-500 hover:text-black dark:hover:text-white flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-sm"
                                        >
                                            <ArrowLeft className="w-3 h-3" /> Overview
                                        </button>
                                    </div>

                                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {(event.lineup || []).map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden relative flex-shrink-0">
                                                    {item.image_url ? (
                                                        <Image src={item.image_url} alt={item.name} fill sizes="36px" className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-gray-500">
                                                            {item.name.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[12px] font-semibold text-black dark:text-white truncate">{item.name}</span>
                                                    {item.role && <span className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">{item.role}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Date and place stay visible while viewing the organizer or lineup. */}
            <div className="border-t border-gray-100 dark:border-zinc-800 py-3 space-y-3">
                <div className="flex items-start gap-3">
                    <Calendar aria-hidden="true" className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                    <div className="min-w-0 flex flex-col">
                        <span className="text-[13px] font-semibold text-black dark:text-white leading-snug">{dateLabel}</span>
                        <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug">{timeLabel}</span>
                    </div>
                </div>
                <div className={`flex items-start gap-3 ${!isExpanded ? 'hidden md:flex' : 'flex'}`}>
                    <MapPin aria-hidden="true" className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                    <div className="min-w-0 flex flex-col">
                        <span className="text-[13px] font-semibold text-black dark:text-white leading-snug">{event.venue_name || event.venue_address || 'Location to be announced'}</span>
                        {event.venue_address && event.venue_address !== event.venue_name && (
                            <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug">{event.venue_address}</span>
                        )}
                    </div>
                </div>
            </div>

            {event.lineup && event.lineup.length > 0 && activeSlide === 'description' && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveSlide('lineup') }}
                    className={`${!isExpanded ? 'hidden md:flex' : 'flex'} w-full items-center gap-3 border-t border-gray-100 dark:border-zinc-800 py-3 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-sm`}
                    aria-label={`View lineup of ${event.lineup.length}`}
                >
                    <div className="flex -space-x-2 flex-shrink-0">
                        {event.lineup.slice(0, 3).map((item, i) => (
                            <div key={i} className="h-6 w-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-gray-100 dark:bg-zinc-800 overflow-hidden relative">
                                {item.image_url ? <Image src={item.image_url} alt="" fill sizes="24px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] font-semibold text-gray-500">{item.name.charAt(0)}</span>}
                            </div>
                        ))}
                    </div>
                    <span className="text-[12px] font-semibold text-black dark:text-white">View lineup</span>
                    <ChevronRight aria-hidden="true" className="w-4 h-4 ml-auto text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                </button>
            )}

            {event.sales_enabled !== false && (
                <button
                    onClick={onGetTickets}
                    className={`w-full h-12 rounded-full bg-[#111111] text-white text-[13px] font-semibold tracking-tight transition-colors active:scale-[0.98] hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black dark:focus-visible:ring-white ${!isExpanded ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'}`}>
                    Get Tickets
                </button>
            )}
            <div className={`flex justify-end mt-3 transition-opacity duration-300 ${!isExpanded ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
                <div className="flex items-center gap-1.5" aria-label="Powered by GatePass">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Powered by</span>
                    <GatePassMark className="size-4" />
                    <span className="text-[11px] font-semibold tracking-tight text-black dark:text-white">GatePass</span>
                </div>
            </div>
        </div >
    )
}

const displayTicketName = (name: string) =>
    /^pay[\s-]*what[\s-]*you[\s-]*want\s*\/\s*pay[\s-]*what[\s-]*you[\s-]*can$/i.test(name)
        ? 'Pay what you want'
        : name

const TicketCard = ({ tier, qty, onQuantityChange }: { tier: TicketTier, qty: number, onQuantityChange: (id: string, delta: number) => void }) => {
    const [showPerks, setShowPerks] = useState(false)
    const isSelected = qty > 0
    const isSoldOut = tier.quantity_sold >= tier.total_quantity
    const remaining = tier.total_quantity - tier.quantity_sold
    const isLowStock = remaining > 0 && remaining <= 10
    const hasPerks = tier.perks && tier.perks.length > 0
    const themeColor = '#111111'

    return (
        <div
            style={isSelected ? { backgroundColor: themeColor, color: '#ffffff' } : {}}
            className={`
                relative w-full rounded-[20px] p-4 flex flex-col justify-between
                transition-all duration-300 min-h-[164px] border
                ${isSelected
                    ? 'shadow-sm border-zinc-900 dark:border-white'
                    : 'bg-white text-black dark:bg-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800'
                }
            `}
        >
            <div className="space-y-3">
                <div>
                    <div className="flex items-start justify-between gap-3">
                        <div className={`text-[22px] font-semibold leading-none tracking-[-0.04em] ${isSelected ? 'text-white' : 'text-black dark:text-white'}`}>
                            {formatCurrency(tier.price, tier.currency)}
                        </div>
                        {isLowStock && (
                            <span role="status" aria-label={`Only ${remaining} tickets remaining`} className={`flex-shrink-0 pt-1 text-[11px] font-medium ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                {remaining} left
                            </span>
                        )}
                    </div>
                    <div className={`mt-1.5 text-[14px] font-medium leading-tight ${isSelected ? 'text-white/90' : 'text-gray-900 dark:text-white'}`}>{displayTicketName(tier.name)}</div>
                    {(tier.tags?.length || (tier.min_quantity && tier.discount_value)) ? (
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium">
                            {tier.tags?.map((tag, idx) => (
                                <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded-full ${
                                        isSelected
                                            ? 'bg-white/15 text-white/80'
                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    {tag}
                                </span>
                            ))}
                            {tier.min_quantity && tier.discount_value && (
                                <span className={isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}>
                                {tier.discount_type === 'percentage'
                                        ? `${tier.discount_value}% off · ${tier.min_quantity}+ tickets`
                                        : `${formatCurrency(tier.discount_value, tier.currency)} off · ${tier.min_quantity}+ tickets`}
                                </span>
                            )}
                        </div>
                    ) : null}
                </div>

                {tier.description && (
                    <p className={`text-[13px] leading-relaxed ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                        {tier.description}
                    </p>
                )}

                {/* Payment plan detail */}
                {tier.allow_instalments && tier.payment_plans && tier.payment_plans.length > 0 && (() => {
                    const plan = tier.payment_plans.find((p: any) => p.is_active)
                    if (!plan) return null
                    const firstPayment = tier.price * plan.initial_percent / 100
                    return (
                        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                            <CalendarClock aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{plan.num_instalments} payments · {formatCurrency(firstPayment, tier.currency)} today</span>
                        </div>
                    )
                })()}

                <div className={`h-px w-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-zinc-800'}`} />

                {hasPerks ? (
                    <div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowPerks(!showPerks); }}
                            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2 hover:opacity-80 transition-opacity ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <span>Perks</span>
                            {showPerks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showPerks && (
                            <ul className="space-y-2.5 animate-fade-in origin-top">
                                {tier.perks!.map((perk, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-[13px] leading-tight">
                                        <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-black'}`}>
                                            <Check className="w-2.5 h-2.5" />
                                        </div>
                                        <span className={isSelected ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'}>{perk}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="h-4" />
                )}
            </div>

            {tier.is_virtual ? (
                <button
                    type="button"
                    onClick={() => onQuantityChange(tier.id, qty === 1 ? -1 : 1)}
                    disabled={isSoldOut}
                    className={`mt-4 w-full h-11 rounded-full flex items-center justify-between px-4 font-semibold text-[13px] transition-all duration-300 cursor-pointer ${
                        isSelected
                            ? 'bg-white text-zinc-950 shadow-md hover:bg-white/90'
                            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <span>{isSoldOut ? 'Sold Out' : isSelected ? 'Selected' : 'Select Ticket'}</span>
                    {!isSoldOut && (
                        <div
                            className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-300 relative ${
                                isSelected
                                    ? 'bg-zinc-900'
                                    : 'bg-zinc-300 dark:bg-zinc-600'
                            }`}
                        >
                            <div
                                className={`w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ${
                                    isSelected ? 'translate-x-3' : 'translate-x-0'
                                }`} 
                            />
                        </div>
                    )}
                </button>
            ) : (
                <div className={`mt-3 flex items-center justify-between px-1 py-1 rounded-full border ${isSelected ? 'bg-white/10 border-white/15' : 'bg-zinc-50 border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700'}`}>
                    <button
                        onClick={() => onQuantityChange(tier.id, -1)}
                        disabled={qty === 0}
                        className={`w-9 h-9 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-black dark:text-white dark:hover:bg-zinc-700'}`}
                    >
                        -
                    </button>
                    <span className={`font-bold text-lg min-w-[20px] text-center ${isSelected ? 'text-white' : 'text-black dark:text-white'}`}>{qty}</span>
                    <button
                        onClick={() => onQuantityChange(tier.id, 1)}
                        disabled={isSoldOut}
                        className={`w-9 h-9 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-black dark:text-white dark:hover:bg-zinc-700'}`}
                    >
                        +
                    </button>
                </div>
            )}
        </div>
    )
}

const TicketsView = ({ tiers, selectedTickets, onQuantityChange, onContinue, onBack, total, hasSelection }: {
    tiers: TicketTier[],
    selectedTickets: Record<string, number>,
    onQuantityChange: (tierId: string, delta: number) => void,
    onContinue: () => void,
    onBack: () => void,
    total: number,
    hasSelection: boolean
}) => (
    <div className="flex flex-col h-full min-h-0 animate-fade-in relative">
        <div className="flex justify-between items-center mb-4 px-1 flex-shrink-0 pt-2">
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">Ticket selection</p>
                <h2 className="text-[20px] font-semibold tracking-tight text-black dark:text-white">Choose your pass</h2>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Select a ticket to continue</p>
            </div>
            <button
                onClick={onBack}
                aria-label="Back to event details"
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white transition-all bg-gray-100/80 hover:bg-gray-100 dark:bg-white/5 rounded-full"
            >
                <ArrowLeft aria-hidden="true" className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto px-1 pb-3 no-scrollbar">
            {tiers.map((tier) => (
                <TicketCard
                    key={tier.id}
                    tier={tier}
                    qty={selectedTickets[tier.id] || 0}
                    onQuantityChange={onQuantityChange}
                />
            ))}
        </div>

        {/* Sticky Footer with Total */}
        <div className="flex-shrink-0 -mx-4 -mb-4 mt-2 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-10">
            <div className="max-w-md mx-auto md:max-w-none">
                <button
                    onClick={onContinue}
                    disabled={!hasSelection}
                    style={{
                        backgroundColor: hasSelection ? '#111111' : undefined,
                        color: hasSelection ? '#ffffff' : undefined
                    }}
                    className={cn(
                        "w-full h-12 rounded-full text-[13px] font-semibold tracking-tight transition-all active:scale-[0.98] flex items-center justify-between px-5",
                        !hasSelection
                            ? "bg-gray-200 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed shadow-none"
                            : "bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 hover:opacity-90"
                    )}
                >
                    <span>Continue</span>
                    <span>{formatCurrency(total, tiers[0]?.currency)}</span>
                </button>
                <div className="flex justify-center mt-3 md:hidden">
                    <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                        Secure Payment by GatePass
                    </span>
                </div>
            </div>
        </div>
    </div>

)

const CheckoutFormView = ({ guestName, setGuestName, guestEmail, setGuestEmail, guestPhone, setGuestPhone, onBack, onContinue, loading, hasTicketsSelected }: {
    guestName: string, setGuestName: (name: string) => void,
    guestEmail: string, setGuestEmail: (email: string) => void,
    guestPhone: string, setGuestPhone: (phone: string) => void,
    onBack: () => void,
    onContinue: () => void,
    loading: boolean,
    hasTicketsSelected: boolean
}) => {
    const [touched, setTouched] = React.useState<Record<string, boolean>>({})
    const [submitted, setSubmitted] = React.useState(false)

    // Validators
    const validateName = (v: string) => {
        if (!v.trim()) return 'Name is required'
        if (v.trim().length < 2) return 'Name must be at least 2 characters'
        return ''
    }
    const validateEmail = (v: string) => {
        if (!v.trim()) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address'
        return ''
    }
    const validatePhone = (v: string) => {
        if (!v.trim()) return 'Phone number is required'
        const digits = v.replace(/\D/g, '')
        if (digits.length < 7) return 'Enter a valid phone number'
        return ''
    }

    const nameError = validateName(guestName)
    const emailError = validateEmail(guestEmail)
    const phoneError = validatePhone(guestPhone)
    const isFormValid = !nameError && !emailError && !phoneError && hasTicketsSelected

    const showError = (field: string, error: string) => (touched[field] || submitted) && error

    const handleSubmit = () => {
        setSubmitted(true)
        if (!isFormValid) return
        onContinue()
    }

    const inputBaseClass = "w-full h-11 px-3 rounded-lg border border-gray-200 bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 transition-colors text-black dark:text-white text-[15px] placeholder:text-gray-400 font-normal shadow-none"
    const inputValidClass = ""
    const inputErrorClass = "border-red-400 focus:border-red-500 focus:ring-red-500/10"

    return (
        <div className="flex flex-col h-full min-h-0 animate-fade-in relative">
            <div className="flex justify-between items-center mb-5 px-1 flex-shrink-0 pt-2">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">Checkout</p>
                    <h2 className="text-[20px] font-semibold tracking-tight text-black dark:text-white">Your details</h2>
                </div>
                <button
                    onClick={onBack}
                    aria-label="Back to previous step"
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-all bg-gray-50 dark:bg-white/5 rounded-full"
                >
                    <ArrowLeft aria-hidden="true" className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 px-1 pb-5">
                <div className="space-y-1.5">
                    <label htmlFor="guest-name" className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Full name</label>
                    <input
                        id="guest-name"
                        type="text"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        onBlur={() => setTouched(p => ({ ...p, name: true }))}
                        placeholder="Jane Smith"
                        aria-invalid={!!showError('name', nameError)}
                        aria-describedby={showError('name', nameError) ? 'guest-name-error' : undefined}
                        className={`${inputBaseClass} ${showError('name', nameError) ? inputErrorClass : inputValidClass}`}
                    />
                    {showError('name', nameError) && (
                    <p id="guest-name-error" role="alert" className="text-red-500 text-[11px] font-medium flex items-center gap-1 animate-fade-in">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {nameError}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="guest-email" className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Email address</label>
                    <input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        onBlur={() => setTouched(p => ({ ...p, email: true }))}
                        placeholder="jane@example.com"
                        aria-invalid={!!showError('email', emailError)}
                        aria-describedby={showError('email', emailError) ? 'guest-email-error' : 'guest-email-hint'}
                        className={`${inputBaseClass} ${showError('email', emailError) ? inputErrorClass : inputValidClass}`}
                    />
                    {showError('email', emailError) ? (
                        <p id="guest-email-error" role="alert" className="text-red-500 text-[11px] font-medium flex items-center gap-1 animate-fade-in">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {emailError}
                        </p>
                    ) : (
                        <p id="guest-email-hint" className="text-[11px] text-gray-400">We&apos;ll send your tickets here.</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="guest-phone" className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Phone number</label>
                    <PhoneInput
                        value={guestPhone}
                        onChange={setGuestPhone}
                        onBlur={() => setTouched(p => ({ ...p, phone: true }))}
                        placeholder="20 123 4567"
                        error={!!showError('phone', phoneError)}
                        id="guest-phone"
                        aria-describedby={showError('phone', phoneError) ? 'guest-phone-error' : undefined}
                        variant="minimal"
                    />
                    {showError('phone', phoneError) && (
                        <p id="guest-phone-error" role="alert" className="text-red-500 text-[11px] font-medium flex items-center gap-1 animate-fade-in">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {phoneError}
                        </p>
                    )}
                </div>
            </div>

            {/* Sticky Footer for Form */}
            <div className="flex-shrink-0 -mx-4 -mb-4 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-10">
                <div className="max-w-md mx-auto md:max-w-none">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || (submitted && !isFormValid)}
                        style={{
                            backgroundColor: isFormValid ? '#111111' : undefined,
                            color: isFormValid ? '#ffffff' : undefined
                        }}
                        className={cn(
                            "w-full h-12 rounded-full text-[13px] font-semibold tracking-tight transition-all active:scale-[0.98] flex items-center justify-center gap-2 group",
                            (loading || (submitted && !isFormValid))
                                ? "bg-gray-200 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed shadow-none"
                                : "bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 hover:opacity-90"
                        )}
                    >
                        {loading ? 'Processing...' : 'Continue to Payment'}
                        {!loading && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                    </button>
                </div>
            </div>
        </div>
    )
}

const AddonsView = ({ availableAddons, selectedAddons, onAddonChange, onContinue, onBack }: {
    availableAddons: EventAddon[],
    selectedAddons: Record<string, number>,
    onAddonChange: (addonId: string, delta: number) => void,
    onContinue: () => void,
    onBack: () => void
}) => {
    const hasSelection = Object.values(selectedAddons).some(qty => qty > 0)

    return (
        <div className="flex flex-col h-full min-h-0 animate-fade-in relative bg-white dark:bg-zinc-900">
            {/* Cleaner Header */}
            <div className="flex justify-between items-center mb-6 px-1 flex-shrink-0 pt-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">Optional add-ons</p>
                    <h2 className="text-[20px] font-semibold tracking-tight text-black dark:text-white leading-tight">Add something extra</h2>
                    <p className="text-[13px] text-gray-400 dark:text-gray-500 font-medium tracking-tight">Select optional extras for your order</p>
                </div>
                <button
                    onClick={onBack}
                    aria-label="Back to ticket selection"
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-all bg-gray-50 dark:bg-white/5 rounded-full"
                >
                    <ArrowLeft aria-hidden="true" className="w-5 h-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-2 px-2 pb-4">
                <div className="space-y-3">
                    {availableAddons.map((addon) => {
                        const qty = selectedAddons[addon.id] || 0
                        const isSelected = qty > 0

                        const remaining = (addon.total_quantity !== null && addon.total_quantity !== undefined)
                            ? Math.max(0, addon.total_quantity - addon.quantity_sold)
                            : Infinity

                        const isSoldOut = remaining <= 0
                        const isMaxed = qty >= remaining

                        return (
                            <div
                                key={addon.id}
                                className={cn(
                                    "group relative overflow-hidden rounded-[18px] border transition-all duration-200",
                                    isSoldOut ? "bg-gray-50 dark:bg-zinc-800/40 border-gray-100 dark:border-white/5 opacity-60" :
                                        isSelected
                                            ? "bg-gray-50 dark:bg-zinc-800/70 border-black dark:border-white"
                                            : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500"
                                )}
                            >
                                <div className="flex p-3 gap-3">
                                    {/* Elevated Image Container */}
                                    <div className="w-[68px] h-[68px] rounded-xl overflow-hidden flex-shrink-0 relative bg-gray-100 dark:bg-zinc-800 border border-black/5 dark:border-white/5">
                                        {addon.image_url ? (
                                            <Image src={addon.image_url} alt={addon.name} fill sizes="68px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800">
                                                <BadgeCheck className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                                            </div>
                                        )}
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-[2px]">
                                                <span className="text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 border border-white/20 rounded-full">Sold Out</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 flex flex-col justify-between py-0.5">
                                        <div>
                                            <div className="flex justify-between items-start mb-0.5">
                                                <h4 className={cn(
                                                    "text-[15px] font-extrabold leading-tight line-clamp-1 tracking-tight",
                                                    "text-black dark:text-white"
                                                )}>{addon.name}</h4>
                                                <span className={cn(
                                                    "font-bold text-[14px] tabular-nums",
                                                    "text-gray-600 dark:text-gray-300"
                                                )}>
                                                    {formatCurrency(addon.price, addon.currency)}
                                                </span>
                                            </div>
                                            {addon.description && (
                                                <p className={cn(
                                                    "text-[12px] line-clamp-2 leading-snug font-medium",
                                                    "text-gray-500 dark:text-gray-400"
                                                )}>{addon.description}</p>
                                            )}
                                        </div>

                                        {/* Interaction Bar */}
                                        <div className="flex items-center justify-between mt-3">
                                            <div className={cn(
                                                "text-[9px] font-black uppercase tracking-[0.15em]",
                                                "text-gray-400 dark:text-gray-500"
                                            )}>
                                                {isSoldOut ? "Unavailable" : isSelected ? "In Cart" : "Optional"}
                                            </div>

                                            {!isSoldOut && (
                                                <div className="flex items-center gap-1.5 transition-all">
                                                    {addon.selection_type === 'toggle' ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onAddonChange(addon.id, isSelected ? -qty : 1); }}
                                                            className={cn(
                                                                "h-8 px-4 rounded-full transition-all text-[12px] font-bold flex items-center justify-center gap-1.5",
                                                                isSelected
                                                                    ? "bg-black text-white dark:bg-white dark:text-black hover:opacity-85"
                                                                    : "bg-black dark:bg-white text-white dark:text-black hover:opacity-90 shadow-sm"
                                                            )}
                                                        >
                                                            {isSelected ? (
                                                                <>
                                                                    <Check className="w-3.5 h-3.5" />
                                                                    Added
                                                                </>
                                                            ) : 'Add'}
                                                        </button>
                                                    ) : (
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 p-1 rounded-full",
                                                            "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                                                        )}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onAddonChange(addon.id, -1); }}
                                                                disabled={qty === 0}
                                                                className={cn(
                                                                    "w-8 h-8 flex items-center justify-center rounded-full transition-all text-xl font-medium",
                                                                    "hover:bg-gray-100 dark:hover:bg-zinc-700 text-black dark:text-white"
                                                                )}
                                                            >
                                                                -
                                                            </button>
                                                            <span className={cn(
                                                                "text-[14px] font-extrabold tabular-nums w-4 text-center",
                                                                "text-black dark:text-white"
                                                            )}>{qty}</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onAddonChange(addon.id, 1); }}
                                                                disabled={isMaxed}
                                                                className={cn(
                                                                    "w-8 h-8 flex items-center justify-center rounded-full transition-all text-xl font-medium",
                                                                    "hover:bg-gray-100 dark:hover:bg-zinc-700 text-black dark:text-white"
                                                                )}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Standard Sticky Footer */}
            <div className="flex-shrink-0 -mx-4 -mb-4 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-10">
                <div className="max-w-md mx-auto md:max-w-none">
                    <button
                        onClick={onContinue}
                        style={{
                            backgroundColor: '#111111',
                            color: '#ffffff'
                        }}
                        className="w-full h-12 rounded-full text-[13px] font-semibold tracking-tight transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 group"
                    >
                        <span>{hasSelection ? 'Continue with Add-ons' : 'No Thanks, Continue'}</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                </div>
            </div>
        </div>
    )
}
const SummaryView = ({ event, tiers, subtotal, addonSubtotal, fees, total, countdown, onRestart, loading, onBack, onPay, promoCode, setPromoCode, onApplyDiscount, discount, discountError, applyingDiscount, selectedTickets, availableAddons = [], selectedAddons = {}, instalmentPlans = [], paymentMode = 'full', onPaymentModeChange, effectiveRates, feeBearer = 'customer', hasMultiTierInstalmentConflict = false }: {
    event: Event,
    tiers: TicketTier[],
    subtotal: number, // Ticket Subtotal
    addonSubtotal: number, // Addon Subtotal
    fees: number,
    total: number,
    loading: boolean,
    onBack: () => void,
    onPay: () => void,
    promoCode: string,
    setPromoCode: (val: string) => void,
    onApplyDiscount: () => void,
    discount: Discount | null,
    discountError: string,
    applyingDiscount: boolean,
    selectedTickets: Record<string, number>,
    countdown: ReservationCountdown,
    onRestart: () => void,
    availableAddons?: EventAddon[],
    selectedAddons?: Record<string, number>,
    instalmentPlans?: PaymentPlan[],
    paymentMode?: 'full' | 'instalment',
    onPaymentModeChange?: (mode: 'full' | 'instalment', plan?: PaymentPlan) => void,
    effectiveRates?: FeeRates,
    feeBearer?: 'customer' | 'organizer',
    hasMultiTierInstalmentConflict?: boolean
}) => {
    const [showPromo, setShowPromo] = useState(false)

    const currency = tiers[0]?.currency
    const promoReduction = discount ? (discount.type === 'fixed' ? discount.value : subtotal * discount.value / 100) : 0
    const orderValue = Math.max(0, subtotal + addonSubtotal - promoReduction)
    const selectedPlan = paymentMode === 'instalment' ? instalmentPlans[0] : null
    const firstShare = selectedPlan ? Math.round(orderValue * selectedPlan.initial_percent) / 100 : 0
    const amountDue = selectedPlan
        ? calculateFees(firstShare, 0, feeBearer, effectiveRates).customerTotal
        : total

    return (
        <div className="flex flex-col h-full flex-1 min-h-0 animate-fade-in relative">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar -mx-4 px-4 pb-4">
                <div className="flex items-center gap-3 mb-4 px-1 flex-shrink-0">
                    <button
                        onClick={onBack}
                        aria-label="Back to attendee details"
                        className="w-8 h-8 -ml-1 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                    >
                        <ArrowLeft aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <h2 className="text-[19px] font-semibold tracking-tight text-black dark:text-white">Review order</h2>
                </div>

                <div className="sticky top-0 z-20 -mx-1 bg-white px-1 pb-3 dark:bg-zinc-900">
                    <ReservationTimer countdown={countdown} onRestart={onRestart} />
                </div>

                {/* Order details */}
                <div className="mx-1 py-4 border-b border-gray-200 dark:border-zinc-800">
                    <div className="pb-3">
                        <h3 className="text-[15px] font-semibold leading-tight text-black dark:text-white">{event.title}</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Ticket Breakdown */}
                        <div className="space-y-3">
                            {tiers.map(tier => {
                                const qty = selectedTickets[tier.id] || 0
                                if (qty === 0) return null

                                let tierSubtotal = tier.price * qty
                                const hasQtyDiscount = !!(tier.min_quantity && qty >= tier.min_quantity && tier.discount_value)
                                let discountLabel = ''
                                if (hasQtyDiscount) {
                                    const discountValue = tier.discount_value || 0
                                    if (tier.discount_type === 'percentage') {
                                        discountLabel = `${discountValue}% off bulk discount`
                                        tierSubtotal = tierSubtotal - (tierSubtotal * (discountValue / 100))
                                    } else if (tier.discount_type === 'fixed') {
                                        discountLabel = `${formatCurrency(discountValue, tier.currency)} off bulk discount`
                                        tierSubtotal = Math.max(0, tierSubtotal - discountValue)
                                    }
                                }

                                return (
                                    <div key={tier.id} className="flex justify-between items-start gap-3 text-[13px]">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-gray-800 dark:text-gray-200">{displayTicketName(tier.name)} <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1">×{qty}</span></span>
                                            {hasQtyDiscount && (
                                                <span className="text-[10px] text-green-700 dark:text-green-400 font-medium mt-0.5">
                                                    ✓ {discountLabel} applied
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-medium text-black dark:text-white whitespace-nowrap tabular-nums">{formatCurrency(tierSubtotal, tier.currency)}</span>
                                    </div>
                                )
                            })}

                            {/* Addons Breakdown */}
                            {selectedAddons && Object.keys(selectedAddons).length > 0 && availableAddons && (
                                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-zinc-800 space-y-2">
                                    {Object.entries(selectedAddons).map(([addonId, qty]) => {
                                        if (qty === 0) return null
                                        const addon = availableAddons.find(a => a.id === addonId)
                                        if (!addon) return null
                                        return (
                                            <div key={addonId} className="flex justify-between items-center gap-3 text-[13px]">
                                                <span className="text-gray-800 dark:text-gray-200">{addon.name} <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1">×{qty}</span></span>
                                                <span className="font-medium text-black dark:text-white whitespace-nowrap tabular-nums">{formatCurrency(addon.price * qty, addon.currency)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-zinc-800 w-full" />

                        {/* Fees & Subtotal */}
                        <div className="space-y-2 text-[13px]">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                                <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatCurrency(subtotal, tiers[0]?.currency)}</span>
                            </div>

                            {addonSubtotal > 0 && (
                                <div className="flex justify-between items-center text-[13px] text-gray-500 dark:text-gray-400">
                                    <span>Add-ons</span>
                                    <span className="tabular-nums">{formatCurrency(addonSubtotal, tiers[0]?.currency)}</span>
                                </div>
                            )}
                            {fees > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400">Service & payment fees</span>
                                    <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatCurrency(fees, tiers[0]?.currency)}</span>
                                </div>
                            )}

                            {/* Discount Row */}
                            {discount && (
                                <div className="flex justify-between items-center text-green-600 animate-fade-in">
                                    <span className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                                        Promo ({discount.code})
                                    </span>
                                    <span className="font-bold">
                                        - {formatCurrency(discount.type === 'fixed' ? discount.value : (subtotal * discount.value / 100), tiers[0]?.currency)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Promo code */}
                        {!discount && (
                            <div>
                                {!showPromo ? (
                                    <button
                                        onClick={() => setShowPromo(true)}
                                        className="text-[12px] text-black dark:text-white font-semibold hover:underline underline-offset-4 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-sm"
                                    >
                                        <span aria-hidden="true" className="text-[16px] font-normal leading-none">+</span>
                                        Add promo code
                                    </button>
                                ) : (
                                    <div className="animate-fade-in space-y-1.5">
                                        <label htmlFor="summary-promo-code" className="block text-[12px] font-medium text-gray-600 dark:text-gray-300">Promo code</label>
                                        <div className="flex gap-2">
                                            <input
                                                id="summary-promo-code"
                                                value={promoCode}
                                                onChange={(e) => setPromoCode(e.target.value)}
                                                placeholder="Enter code"
                                                className="min-w-0 flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-[13px] px-3 py-2 uppercase placeholder:normal-case focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white outline-none transition-colors text-black dark:text-white"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        onApplyDiscount()
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setShowPromo(false)
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={onApplyDiscount}
                                                disabled={!promoCode || applyingDiscount}
                                                className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
                                            >
                                                {applyingDiscount ? 'Applying…' : 'Apply'}
                                            </button>
                                            <button
                                                onClick={() => setShowPromo(false)}
                                                aria-label="Close promo code field"
                                                className="p-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        {discountError && <p className="text-red-500 text-[11px] mt-1.5 font-medium ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{discountError}</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border-t border-gray-100 dark:border-zinc-800" />

                        {hasMultiTierInstalmentConflict && (
                            <div className="border border-gray-200 dark:border-zinc-700 rounded-xl p-3 space-y-1 text-[12px] animate-in fade-in slide-in-from-top-1 duration-200">
                                <p className="font-semibold text-black dark:text-white">Part-pay unavailable for this order</p>
                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">To use part-pay, purchase one ticket type at a time.</p>
                            </div>
                        )}

                        {/* Instalment Payment Option - Inside summary card */}
                        {instalmentPlans.length > 0 && onPaymentModeChange && (() => {
                            const plan = instalmentPlans[0]
                            // Split the ORDER VALUE (tickets + addons - discount), NOT the total with fees
                            const planFirstShare = Math.round(orderValue * plan.initial_percent) / 100
                            const planFirstDue = calculateFees(planFirstShare, 0, feeBearer, effectiveRates).customerTotal
                            const remainingVal = Math.round((orderValue - planFirstShare) * 100) / 100
                            const perInstalment = Math.round(remainingVal / (plan.num_instalments - 1) * 100) / 100

                            return (
                                <div className="space-y-3">
                                    <p className="text-[12px] font-semibold text-gray-900 dark:text-white">Payment option</p>
                                    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 dark:bg-zinc-800 p-1">
                                        <button
                                            onClick={() => onPaymentModeChange('full')}
                                            aria-pressed={paymentMode === 'full'}
                                            className={`p-2.5 rounded-xl transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ${paymentMode === 'full'
                                                ? 'bg-white dark:bg-zinc-700 shadow-sm'
                                                : 'hover:bg-white/50 dark:hover:bg-zinc-700/50'
                                                }`}
                                        >
                                            <span className="text-[12px] font-semibold text-gray-900 dark:text-white block">Pay in full</span>
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{formatCurrency(total, tiers[0]?.currency)} now</span>
                                        </button>
                                        <button
                                            onClick={() => onPaymentModeChange('instalment', plan)}
                                            aria-pressed={paymentMode === 'instalment'}
                                            className={`p-2.5 rounded-xl transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ${paymentMode === 'instalment'
                                                ? 'bg-white dark:bg-zinc-700 shadow-sm'
                                                : 'hover:bg-white/50 dark:hover:bg-zinc-700/50'
                                                }`}
                                        >
                                            <span className="text-[12px] font-semibold text-gray-900 dark:text-white block">Pay in {plan.num_instalments}</span>
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{formatCurrency(planFirstDue, currency)} today</span>
                                        </button>
                                    </div>

                                    {/* Instalment Schedule Preview */}
                                    {paymentMode === 'instalment' && (
                                        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <p className="text-[12px] font-semibold text-gray-900 dark:text-white">Payment schedule <span className="font-normal text-gray-500 dark:text-gray-400">· before fees</span></p>
                                            {(() => {
                                                const schedule = []
                                                schedule.push({ num: 1, amount: planFirstShare, label: 'Today' })
                                                for (let i = 2; i <= plan.num_instalments; i++) {
                                                    const daysFromNow = plan.deadline_days * (i - 1)
                                                    const amt = i === plan.num_instalments
                                                        ? Math.round((remainingVal - perInstalment * (plan.num_instalments - 2)) * 100) / 100
                                                        : perInstalment
                                                    schedule.push({ num: i, amount: amt, label: `In ${daysFromNow} days` })
                                                }
                                                return (
                                                    <>
                                                        {schedule.map(s => (
                                                            <div key={s.num} className="flex justify-between items-center gap-3 text-[12px]">
                                                                <span className="text-gray-600 dark:text-gray-300">Payment {s.num} · {s.label}</span>
                                                                <span className="font-medium text-black dark:text-white tabular-nums">
                                                                    {formatCurrency(s.amount, tiers[0]?.currency)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </>
                                                )
                                            })()}
                                            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800 mt-1">
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                                    Your ticket is reserved today and issued after the final payment.
                                                </p>
                                                <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">
                                                    Missed payments may forfeit your reservation without a refund.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                    </div>
                </div>

                {/* Terms */}
                <p className="text-center text-[11px] text-gray-500 dark:text-gray-400 mt-4 px-4 leading-relaxed mb-2">
                    By purchasing, you agree to the <Link href="/terms-of-service" className="underline underline-offset-2 hover:text-black dark:hover:text-white">Terms of Service</Link> and <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-black dark:hover:text-white">Privacy Policy</Link>.
                    All sales are final.
                </p>
            </div>

            {/* Payment action remains visible while reviewing longer orders. */}
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 p-4 -mx-4 -mb-4 z-30 flex-shrink-0">
                <div className="max-w-md mx-auto md:max-w-none">
                    <div className="flex items-end justify-between gap-3 pb-3">
                        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{selectedPlan ? 'Due today' : 'Total due'}</span>
                        <div className="text-right">
                            <span className="block text-[21px] leading-none font-semibold tracking-[-0.04em] tabular-nums text-black dark:text-white">{formatCurrency(amountDue, currency)}</span>
                            {selectedPlan && <span className="block mt-1 text-[11px] text-gray-500 dark:text-gray-400">of {formatCurrency(orderValue, currency)} order · fees included today</span>}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onPay}
                        disabled={loading || countdown.expired}
                        className={cn(
                            "w-full h-12 rounded-full text-[13px] font-semibold tracking-tight transition-colors active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black dark:focus-visible:ring-white",
                            (loading || countdown.expired)
                                ? "bg-gray-200 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed shadow-none"
                                : "bg-[#111111] dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-gray-100"
                        )}
                    >
                        {loading ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                        ) : selectedPlan ? (
                            <>Pay {formatCurrency(amountDue, currency)} today</>
                        ) : (
                            <>Pay {formatCurrency(amountDue, currency)}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

const SuccessView = ({ event, tickets, tierName, onClose }: { event: Event, tickets: any[], tierName: string | undefined, onClose: () => void }) => {
    const supabase = createClient()
    const [downloading, setDownloading] = useState(false)
    const [questions, setQuestions] = useState<EventFormQuestion[]>([])
    const [fetchingQuestions, setFetchingQuestions] = useState(true)
    const [formSubmitted, setFormSubmitted] = useState(false)
    const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submittingForm, setSubmittingForm] = useState(false)

    const activeTicket = tickets[0] // Primary ticket for QR

    useEffect(() => {
        const loadQuestionsAndResponses = async () => {
            if (!activeTicket || !activeTicket.reservation_id) {
                setFetchingQuestions(false)
                return
            }

            try {
                // 1. Fetch questions for this event
                const { data: qData, error: qError } = await supabase
                    .schema('gatepass')
                    .from('event_form_questions')
                    .select('*')
                    .eq('event_id', event.id)
                    .order('sort_order', { ascending: true })

                if (qError) throw qError

                if (qData && qData.length > 0) {
                    setQuestions(qData)
                    
                    // 2. Fetch responses for this reservation
                    const { data: rData, error: rError } = await supabase
                        .schema('gatepass')
                        .from('event_form_responses')
                        .select('*')
                        .eq('reservation_id', activeTicket.reservation_id)

                    if (rError) throw rError

                    if (rData && rData.length > 0) {
                        setFormSubmitted(true)
                    }
                }
            } catch (err) {
                console.error('Error loading questions/responses:', err)
            } finally {
                setFetchingQuestions(false)
            }
        }

        loadQuestionsAndResponses()
    }, [event.id, activeTicket, supabase])

    const handleInputChange = (questionId: string, value: string | boolean) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }))
        if (errors[questionId]) {
            setErrors(prev => {
                const updated = { ...prev }
                delete updated[questionId]
                return updated
            })
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}
        questions.forEach(q => {
            const answer = answers[q.id]
            if (q.required) {
                if (q.type === 'checkbox' && !answer) {
                    newErrors[q.id] = 'This field is required'
                } else if (q.type !== 'checkbox' && (answer === undefined || answer === null || String(answer).trim() === '')) {
                    newErrors[q.id] = 'This field is required'
                }
            }
        })
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateForm()) return

        setSubmittingForm(true)
        try {
            const responseData = questions.map(q => {
                let answerStr = ''
                if (q.type === 'checkbox') {
                    answerStr = answers[q.id] ? 'Yes' : 'No'
                } else {
                    answerStr = String(answers[q.id] || '').trim()
                }

                return {
                    reservation_id: activeTicket.reservation_id,
                    question_id: q.id,
                    answer: answerStr
                }
            })

            const { error } = await supabase
                .schema('gatepass')
                .from('event_form_responses')
                .insert(responseData)

            if (error) throw error

            setFormSubmitted(true)
            toast.success('Information submitted successfully!')
        } catch (err: any) {
            console.error('Error submitting form responses:', err)
            toast.error(err.message || 'Failed to submit details')
        } finally {
            setSubmittingForm(false)
        }
    }

    const handleDownloadPDF = async () => {
        if (!tickets || tickets.length === 0) return
        const reservationId = tickets[0].reservation_id
        if (!reservationId) {
            toast.error('Reservation ID missing')
            return
        }

        setDownloading(true)
        window.location.href = `/api/reservations/${reservationId}/download`
        setTimeout(() => setDownloading(false), 2000)
    }

    // Confetti Effect
    useEffect(() => {
        if (fetchingQuestions || (questions.length > 0 && !formSubmitted)) return;

        const runConfetti = async () => {
            const confetti = (await import('canvas-confetti')).default
            const end = Date.now() + 1000;
            const colors = ['#000000', '#FFD700', '#ffffff'];

            (function frame() {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
        runConfetti()
    }, [fetchingQuestions, questions.length, formSubmitted])

    const handleShare = async () => {
        const shareData = {
            title: `I'm going to ${event.title}!`,
            text: `Join me at ${event.title} at ${event.venue_name}!`,
            url: window.location.href
        }

        if (navigator.share) {
            try {
                await navigator.share(shareData)
            } catch (err) {
                console.error('Share failed:', err)
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
                toast.success('Link copied to clipboard!')
            } catch (err) {
                toast.error('Failed to copy link')
            }
        }
    }

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name} ${event.venue_address}`)}`

    const getGoogleCalendarUrl = () => {
        const start = new Date(event.starts_at)
        const end = new Date(start.getTime() + (2 * 60 * 60 * 1000))
        const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "")
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatTime(start)}/${formatTime(end)}&details=${encodeURIComponent(`Tickets: ${window.location.href}`)}&location=${encodeURIComponent(event.venue_name)}`
    }

    const getCountdown = () => {
        const diff = new Date(event.starts_at).getTime() - Date.now()
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
        if (days < 0) return null
        if (days === 0) return "Starts Today!"
        if (days === 1) return "Starts Tomorrow!"
        return `Starts in ${days} Days`
    }

    const countdownText = getCountdown()

    const ticketCounts = tickets.reduce((acc, ticket) => {
        const name = ticket.ticket_tiers?.name || tierName || 'General Admission'
        acc[name] = (acc[name] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    if (fetchingQuestions) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-zinc-900 rounded-[24px]">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400 dark:text-zinc-500 mb-3" />
                <p className="text-sm font-medium">Checking reservation details...</p>
            </div>
        )
    }

    if (questions.length > 0 && !formSubmitted) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-[24px] overflow-hidden relative animate-fade-in">
                {/* Header */}
                <div className="flex-shrink-0 px-5 pt-5 pb-2 flex justify-between items-start">
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Order complete</p>
                        <h2 className="text-[20px] leading-tight font-semibold tracking-tight text-black dark:text-white">
                            A few more details
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Please answer the questions below to access your tickets.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close attendee details"
                        className="p-1.5 -mr-1.5 -mt-1.5 text-black dark:text-white hover:opacity-70 transition-opacity"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Form Content */}
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto no-scrollbar px-5 pb-5 space-y-4 my-4 flex flex-col justify-between">
                    <div className="space-y-4">
                        {questions.map((q) => (
                            <div key={q.id} className="space-y-1.5">
                                <label htmlFor={`attendee-${q.id}`} className="block text-[12px] font-medium text-gray-600 dark:text-gray-300">
                                    {q.label}
                                    {q.required && <span className="text-red-500 ml-1">*</span>}
                                </label>

                                {q.type === 'text' && (
                                    <input
                                        id={`attendee-${q.id}`}
                                        type="text"
                                        value={(answers[q.id] as string) || ''}
                                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                                        className="w-full h-11 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-black dark:text-white rounded-lg px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                                        placeholder="Your answer..."
                                        aria-invalid={!!errors[q.id]}
                                        aria-describedby={errors[q.id] ? `attendee-${q.id}-error` : undefined}
                                    />
                                )}

                                {q.type === 'select' && (
                                    <div className="relative">
                                        <select
                                            id={`attendee-${q.id}`}
                                            value={(answers[q.id] as string) || ''}
                                            onChange={(e) => handleInputChange(q.id, e.target.value)}
                                            className="w-full h-11 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-black dark:text-white rounded-lg px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-colors appearance-none"
                                            aria-invalid={!!errors[q.id]}
                                            aria-describedby={errors[q.id] ? `attendee-${q.id}-error` : undefined}
                                        >
                                            <option value="" className="text-gray-500">Select an option...</option>
                                            {q.options?.map((opt, oIdx) => (
                                                <option key={oIdx} value={opt} className="text-black dark:text-white">
                                                    {opt}
                                                    {/* Standard HTML Option styling is fine */}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                )}

                                {q.type === 'checkbox' && (
                                    <label htmlFor={`attendee-${q.id}`} className="flex items-center gap-3 cursor-pointer group mt-2">
                                        <input
                                            id={`attendee-${q.id}`}
                                            type="checkbox"
                                            checked={!!answers[q.id]}
                                            onChange={(e) => handleInputChange(q.id, e.target.checked)}
                                            aria-invalid={!!errors[q.id]}
                                            aria-describedby={errors[q.id] ? `attendee-${q.id}-error` : undefined}
                                            className="w-5 h-5 rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 checked:bg-black dark:checked:bg-white focus:ring-0 cursor-pointer animate-none"
                                        />
                                        <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                                            Yes, I agree / confirm
                                        </span>
                                    </label>
                                )}

                                {errors[q.id] && (
                                    <p id={`attendee-${q.id}-error`} role="alert" className="text-[11px] text-red-500 font-medium">{errors[q.id]}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5 mt-4">
                        <button
                            type="submit"
                            disabled={submittingForm}
                            className="w-full h-12 text-[13px] font-semibold tracking-tight rounded-full transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 bg-black dark:bg-white text-white dark:text-black"
                        >
                            {submittingForm ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
                                    Submitting Details...
                                </>
                            ) : (
                                <>
                                    Submit & Get Tickets
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-[24px] overflow-hidden relative animate-fade-in">
            {/* Header / Dismiss */}
            <div className="flex-shrink-0 px-5 pt-5 pb-2 flex justify-between items-start">
                <div className="space-y-1">
                    <h2 className="text-[18px] leading-tight font-extrabold tracking-tight text-black dark:text-white max-w-[200px]">
                        See you at {event.title}!🎉
                    </h2>
                    {countdownText && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 text-[10px] font-semibold tracking-wide">
                            {countdownText}
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close ticket details"
                    className="p-1.5 -mr-1.5 -mt-1.5 text-black dark:text-white hover:opacity-70 transition-opacity"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-5">

                {/* QR Code or Virtual Streaming card */}
                {activeTicket.ticket_tiers?.is_virtual ? (
                    <div className="w-full text-center space-y-4 my-6">
                        {activeTicket.ticket_tiers.virtual_link ? (
                            <div className="w-full text-center space-y-4">
                                <a
                                    href={activeTicket.ticket_tiers.virtual_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full h-12 flex items-center justify-center bg-black dark:bg-white text-white dark:text-black rounded-full font-semibold text-[13px] hover:opacity-90 active:scale-[0.98] transition-all"
                                >
                                    Join Livestream Now
                                </a>
                                {activeTicket.ticket_tiers.virtual_instructions && (
                                    <div className="w-full bg-zinc-50 dark:bg-zinc-800/30 p-5 rounded-3xl border border-black/5 dark:border-white/5 text-left">
                                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-2">Instructions</span>
                                        <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium whitespace-pre-wrap leading-relaxed">{activeTicket.ticket_tiers.virtual_instructions}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-700 p-5 rounded-[20px] text-center space-y-3">
                                <div className="mx-auto w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </div>
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Livestream Link Coming Soon</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                    The livestream link hasn&apos;t been published by the organizer yet. As soon as the link goes live, it will activate here and you will be notified via email & SMS.
                                </p>
                                {activeTicket.ticket_tiers.virtual_instructions && (
                                    <div className="w-full bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-black/5 dark:border-white/5 text-left mt-2">
                                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">Pre-event Instructions</span>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium whitespace-pre-wrap leading-relaxed">{activeTicket.ticket_tiers.virtual_instructions}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* QR Code */
                    <div className="flex flex-col items-center my-6">
                        <div className="bg-white p-2 rounded-2xl border border-gray-200 dark:border-zinc-700 mb-3">
                            <Image
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${activeTicket.qr_code_hash}&color=000000`}
                                alt="QR Code"
                                width={160}
                                height={160}
                                className="w-32 h-32 object-contain mix-blend-multiply"
                                unoptimized
                            />
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 dark:text-gray-500 select-all">
                            {activeTicket.qr_code_hash}
                        </span>
                    </div>
                )}

                {/* Ticket Details Card */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-[20px] p-4 space-y-3">
                    {/* Event Title in Card */}
                    <div>
                        <h3 className="text-[16px] font-bold text-black dark:text-white leading-tight mb-0.5">{event.title}</h3>
                    </div>

                    {/* Ticket List */}
                    <div className="space-y-2.5">
                        {Object.entries(ticketCounts).map(([name, count]) => (
                            <div key={name} className="flex justify-between items-center text-[13px]">
                                <span className="font-medium text-black dark:text-white">{name}</span>
                                <span className="font-bold text-gray-500 dark:text-gray-400">x{count as number}</span>
                            </div>
                        ))}
                    </div>

                    <div className="h-px w-full bg-gray-200 dark:bg-white/10" />

                    {/* Metadata Grid */}
                    <div className="space-y-3 text-[13px]">
                        <div className="flex justify-between items-start">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Location</span>
                            <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-black dark:text-white text-right max-w-[60%] leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-end gap-1"
                            >
                                {event.venue_name}
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Date</span>
                            <div className="text-right flex items-center gap-2">
                                <a
                                    href={getGoogleCalendarUrl()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 -mr-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                    title="Add to Google Calendar"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </a>
                                <span className="font-bold text-black dark:text-white">
                                    {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Quantity</span>
                            <span className="font-bold text-black dark:text-white text-right">
                                {tickets.length} {tickets.length === 1 ? 'Ticket' : 'Tickets'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5">
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={downloading}
                        className="w-full h-12 bg-black dark:bg-white text-white dark:text-black rounded-full text-[13px] font-semibold tracking-tight hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {downloading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
                                <Download className="w-3.5 h-3.5" />
                            </div>
                        )}
                        {downloading ? 'Preparing Tickets...' : 'Download PDF Tickets'}
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={handleShare}
                            className="flex-1 h-11 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-full text-[12px] font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                        <a
                            href={getGoogleCalendarUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 h-11 bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-200 dark:border-zinc-700 rounded-full text-[12px] font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                        >
                            <Calendar className="w-4 h-4" />
                            Calendar
                        </a>
                    </div>
                </div>

                {/* Footer Links */}
                <div className="flex flex-col items-center justify-center mt-6 space-y-3">
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <a
                            href={`/api/reservations/${tickets[0]?.reservation_id}/receipt`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-black dark:hover:text-white transition-colors underline decoration-zinc-200 underline-offset-4"
                        >
                            View Receipt
                        </a>
                        <span className="w-1 h-1 bg-gray-200 rounded-full" />
                        <a href="mailto:support@gatepass.so" className="hover:text-black dark:hover:text-white transition-colors underline decoration-zinc-200 underline-offset-4">
                            Support
                        </a>
                    </div>
                    <p className="text-[9px] font-bold text-gray-300 dark:text-zinc-600 uppercase tracking-[0.2em]">GatePass Digital Protection</p>
                </div>
            </div>
        </div>
    )
}
const EventCardSkeleton = () => (
    <div className={`
        fixed z-50 bg-white dark:bg-zinc-900 shadow-2xl font-sans
        bottom-4 left-4 right-4
        mb-[env(safe-area-inset-bottom)]
        rounded-2xl
        md:translate-x-0 md:translate-y-0 md:top-auto md:left-auto md:w-[360px] md:mb-0
        md:bottom-12 md:right-12 p-4
        animate-pulse
    `}>
        {/* Header Skeleton */}
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800" />
                <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-zinc-800 rounded" />
                </div>
            </div>
            <div className="h-5 w-16 bg-gray-200 rounded" />
        </div>

        {/* Description Lines */}
        <div className="space-y-2 mb-6">
            <div className="h-3 w-full bg-gray-200 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-[90%] bg-gray-200 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-[80%] bg-gray-200 dark:bg-zinc-800 rounded" />
        </div>

        {/* Date/Loc Skeleton */}
        <div className="flex justify-between mb-6">
            <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-800 rounded" />
        </div>

        {/* Button Skeleton */}
        <div className="h-10 w-full bg-gray-200 dark:bg-zinc-800 rounded-lg" />
    </div>
)

const SummaryTicketItem = ({ tier, qty }: { tier: TicketTier, qty: number }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasDescription = !!tier.description

    return (
        <div className="text-[14px] py-1">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <button
                        onClick={() => hasDescription && setIsExpanded(!isExpanded)}
                        className={`text-left font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-1.5 ${hasDescription ? 'hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer' : ''}`}
                        disabled={!hasDescription}
                    >
                        {tier.name}
                        <span className="text-gray-400 dark:text-gray-500 font-normal whitespace-nowrap">x{qty}</span>
                        {hasDescription && (
                            <ChevronDown className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                    </button>
                </div>
                <div className="font-bold flex-shrink-0 whitespace-nowrap">
                    {formatCurrency(tier.price * qty, tier.currency)}
                </div>
            </div>

            {hasDescription && isExpanded && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mt-1.5 animate-fade-in pl-1">
                    {tier.description}
                </div>
            )}
        </div>
    )
}
