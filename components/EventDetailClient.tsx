'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
// Dynamic imports for heavy libraries
// import html2canvas from 'html2canvas'
// import jsPDF from 'jspdf'
// import confetti from 'canvas-confetti'
import { Event, TicketTier, Discount } from '@/types/gatepass'
import { cn, getContrastColor } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { ReceiptTicket } from '@/components/ticket/ReceiptTicket'

import { createReservation } from '@/utils/gatepass'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Globe, Calendar, ChevronDown, ChevronUp, Check, ChevronRight, Share2, Clock, MapPin, Heart, BadgeCheck, Loader2, Download, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { calculateFees, FeeRates, getEffectiveFeeRates } from '@/utils/fees'
import { motion } from 'framer-motion'

interface EventDetailClientProps {
    event: Event
    tiers: TicketTier[]
    isFeedItem?: boolean
    layoutId?: string
    feeRates?: FeeRates
    availableAddons?: any[] // Using any[] for now or safe EventAddon[]
}

// Simple Timer Hook
const useTimer = (expiresAt: string | undefined): { label: string, seconds: number } => {
    const [timeLeft, setTimeLeft] = useState({ label: '', seconds: 0 })

    useEffect(() => {
        if (!expiresAt) {
            setTimeLeft({ label: '...', seconds: 0 }) // Or some default state
            return
        }

        const end = new Date(expiresAt).getTime()
        const timer = setInterval(() => {
            const now = new Date().getTime()
            const dist = end - now

            if (dist < 0) {
                clearInterval(timer)
                setTimeLeft({ label: 'EXPIRED', seconds: 0 })
                return
            }

            const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60))
            const s = Math.floor((dist % (1000 * 60)) / 1000)
            setTimeLeft({ label: `${m}m ${s}s`, seconds: Math.floor(dist / 1000) })
        }, 1000)

        return () => clearInterval(timer)
    }, [expiresAt])

    return timeLeft
}

export function EventDetailClient({ event, tiers, isFeedItem = false, layoutId, feeRates, availableAddons = [] }: EventDetailClientProps) {
    const [view, setView] = useState<'details' | 'tickets' | 'addons' | 'checkout' | 'summary' | 'success'>('details')

    // Track View Count
    useEffect(() => {
        if (!isFeedItem) {
            // Skip incrementing views for previews
            if (event.id === 'preview-id') return

            const supabase = createClient()
            supabase.rpc('increment_event_view', { event_id: event.id })
                .then(({ error }) => {
                    if (error) console.error('Error incrementing view count:', error.message || error)
                })
        }
    }, [event.id, isFeedItem])
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({})
    const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
    const [reservation, setReservation] = useState<any>(null)
    const [purchasedTickets, setPurchasedTickets] = useState<any[]>([])

    // Mobile Expansion State
    const [isExpanded, setIsExpanded] = useState(false)

    // Navigation Helper
    const navigate = (newView: typeof view, dir: 'forward' | 'back' = 'forward') => {
        setDirection(dir)
        setView(newView)
        // Auto-expand on navigation to deeper views
        if (newView !== 'details') setIsExpanded(true)
    }

    // Form State
    const [guestName, setGuestName] = useState('')
    const [guestEmail, setGuestEmail] = useState('')
    const [guestPhone, setGuestPhone] = useState('')

    // Discount State
    const [promoCode, setPromoCode] = useState('')
    const [discount, setDiscount] = useState<Discount | null>(null)
    const [discountError, setDiscountError] = useState('')
    const [applyingDiscount, setApplyingDiscount] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const timeLeft = useTimer(reservation?.expires_at)

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
                    const response = await fetch('/api/paystack/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference, reservationId: reference })
                    })
                    const result = await response.json()

                    window.history.replaceState({}, '', window.location.pathname)

                    if (!result.success) throw new Error(result.error || 'Verification failed')

                    setPurchasedTickets(result.tickets || [])
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
            const intent = current + delta
            if (intent < 0) return prev
            return { ...prev, [addonId]: intent }
        })
    }

    const calculatedTotal = React.useMemo(() => {
        let total = 0
        // Tickets
        Object.entries(selectedTickets).forEach(([tierId, qty]) => {
            const tier = tiers.find(t => t.id === tierId)
            if (tier) total += tier.price * qty
        })
        // Addons
        if (availableAddons) {
            Object.entries(selectedAddons).forEach(([addonId, qty]) => {
                const addon = availableAddons.find(a => a.id === addonId)
                if (addon) total += addon.price * qty
            })
        }
        return total
    }, [selectedTickets, tiers, selectedAddons, availableAddons])

    // Discount Calculation
    // Discount Calculation
    const discountAmount = React.useMemo(() => {
        if (!discount) return 0

        let targetAmount = calculatedTotal // Default: All tickets

        // If Tier Specific, filter only relevant amount
        if (discount.tier_id) {
            const qty = selectedTickets[discount.tier_id] || 0
            const tier = tiers.find(t => t.id === discount.tier_id)
            if (!tier || qty === 0) return 0 // Apply nothing if target tier not selected
            targetAmount = tier.price * qty
        }

        return discount.type === 'fixed'
            ? discount.value // Fixed usually applies once to order? Or per item? Legacy suggests once to order. Stick to that.
            : (targetAmount * (discount.value / 100))
    }, [discount, calculatedTotal, selectedTickets, tiers])

    const discountedSubtotal = Math.max(0, calculatedTotal - discountAmount)
    // Use effective rates for THIS event
    const effectiveRates = getEffectiveFeeRates(feeRates, event)
    const { clientFees, customerTotal } = calculateFees(discountedSubtotal, event.fee_bearer as 'customer' | 'organizer', effectiveRates)
    const platformFees = clientFees
    const totalDue = customerTotal

    const applyPromoCode = async () => {
        if (!promoCode.trim()) return
        setApplyingDiscount(true)
        setDiscountError('')
        setDiscount(null)

        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('discounts')
                .select('*')
                .eq('event_id', event.id)
                .eq('code', promoCode.toUpperCase())
                .single()

            if (error || !data) {
                setDiscountError('Invalid promo code')
                return
            }

            // Check limits
            if (data.max_uses && data.used_count >= data.max_uses) {
                setDiscountError('This code has been fully redeemed')
                return
            }

            // Check Tier Restriction
            if (data.tier_id) {
                const requiredTier = tiers.find(t => t.id === data.tier_id)
                const hasTierInCart = (selectedTickets[data.tier_id] || 0) > 0

                if (!hasTierInCart) {
                    setDiscountError(`This code is only valid for ${requiredTier?.name || 'specific'} tickets`)
                    return
                }
            }

            setDiscount(data as Discount)

            // Update the existing reservation with this discount (Secure RPC)
            if (reservation) {
                console.log('Linking Discount to Reservation via RPC:', reservation.id)
                const { data: rpcData, error: updateError } = await supabase.rpc('apply_reservation_discount', {
                    p_reservation_id: reservation.id,
                    p_discount_code: promoCode
                })

                if (updateError || (rpcData && !rpcData.success)) {
                    console.error('Failed to link discount:', updateError || rpcData?.error)
                    const errorMsg = updateError?.message || rpcData?.error || 'Failed to apply discount'
                    // If "Discount code usage limit reached", show that
                    setDiscountError(errorMsg)
                    return
                }
            }

            toast.success('Discount applied!')
        } catch (e) {
            setDiscountError('Failed to verify code')
        } finally {
            setApplyingDiscount(false)
        }
    }

    const handleContinueToCheckout = () => {
        if (availableAddons && availableAddons.length > 0) {
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
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                userId = user.id
            }
            // Guest Flow: No signup required anymore. We just pass the details.

            // 2. Determine Selection
            const firstTierId = Object.keys(selectedTickets).find(id => selectedTickets[id] > 0)
            if (!firstTierId) throw new Error('No tickets selected')
            const qty = selectedTickets[firstTierId]
            const selectedTier = tiers.find(t => t.id === firstTierId)

            if (!selectedTier || !qty) throw new Error('Please select a ticket')

            // 3. Create Reservation
            console.log('Creating Reservation with Discount:', discount)
            const newReservation = await createReservation(event.id, selectedTier.id, userId, qty, supabase, {
                email: guestEmail,
                name: guestName,
                phone: guestPhone
            }, discount?.id, selectedAddons)
            if (!newReservation || !newReservation.id) throw new Error('Failed to create reservation')

            setReservation(newReservation)
            setReservation(newReservation)
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
        if (!reservation) {
            toast.error('No active reservation found. Please try again.')
            return
        }

        setLoading(true)

        const firstTierId = Object.keys(selectedTickets).find(id => selectedTickets[id] > 0)
        const selectedTier = tiers.find(t => t.id === firstTierId)

        // Safety Sync: Ensure discount is linked before payment
        if (discount && reservation && reservation.discount_id !== discount.id) {
            console.log('Syncing Discount ID before payment...', discount.id)
            await supabase.rpc('apply_reservation_discount', {
                p_reservation_id: reservation.id,
                p_discount_code: promoCode
            })
            // Update local state implicitly or just proceed
        }

        try {
            // Call Initialize API
            const response = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: guestEmail || 'customer@gatepass.com',
                    amount: Math.round(totalDue * 100),
                    currency: selectedTier?.currency || 'GHS',
                    reservationId: reservation.id,
                    callbackUrl: `${window.location.protocol}//${window.location.host}${window.location.pathname}?event_id=${event.id}` // Append Event ID to scope callback
                })
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Payment initialization failed')

            // Redirect to Paystack
            window.location.href = data.authorization_url

        } catch (error: any) {
            console.error('Payment Error:', error)
            toast.error(error.message)
            setLoading(false)
        }
    }


    const hasSelection = calculatedTotal > 0
    const cheapestTier = tiers.length > 0 ? tiers[0] : null
    const isModalExpanded = view !== 'details'

    // Mobile Expansion Logic
    const toggleExpand = () => {
        if (view === 'details') {
            // Haptic Feedback
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(10) // Taptic-like light impact
            }
            setIsExpanded(!isExpanded)
        }
    }

    const cardHeightClass = (view === 'details' && !isExpanded)
        ? 'max-h-[160px]' // Collapsed height: Compact for 1 line
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
                        if (view === 'success') window.location.reload()
                        else if (view !== 'details') navigate('details', 'back')
                        else setIsExpanded(false) // Dismiss focus mode on mobile
                    }}
                />
            )}

            {/* Floating Card / Modal Container */}
            <motion.div
                layoutId={layoutId}
                onClick={() => {
                    // Always toggle expand, never navigate away
                    toggleExpand()
                }}
                style={{ WebkitTapHighlightColor: 'transparent' }} // Remove Android/iOS blue tap highlight
                className={`
                ${(isFeedItem && view !== 'success') ? 'absolute cursor-pointer active:scale-[0.98] hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-white/10' : 'fixed'} ${view === 'success' ? 'z-[100]' : 'z-50'} bg-white dark:bg-zinc-900 text-black dark:text-white shadow-2xl ${(view === 'details' || view === 'success') ? 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]' : ''} font-sans select-none
                bottom-4 left-4 right-4 
                mb-[env(safe-area-inset-bottom)]
                rounded-2xl flex flex-col ${(view === 'details' && !isExpanded) || view === 'summary' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'}
                ${cardHeightClass}
                md:translate-x-0 md:translate-y-0 md:top-auto md:left-auto md:w-[360px] md:mb-0 md:max-h-[85vh]
                md:bottom-12 md:right-12 p-4
                border border-transparent dark:border-zinc-800
                ${view === 'success' ? 'md:bottom-8 md:right-8 md:w-[380px]' : ''}
                ${(view === 'details' && !isExpanded) ? 'cursor-pointer active:scale-[0.98]' : ''}
            `}>
                {view === 'details' && (
                    <div className="animate-fade-in h-full">
                        <DetailsView
                            event={event}
                            cheapestTier={cheapestTier}
                            onGetTickets={(e: React.MouseEvent) => {
                                e.stopPropagation(); // Prevent toggling when clicking button
                                navigate('tickets', 'forward')
                            }}
                            isExpanded={isExpanded}
                            isFeedItem={isFeedItem}
                        />
                    </div>
                )}
                {view === 'tickets' && (
                    <div className="animate-fade-in h-full">
                        <TicketsView
                            tiers={tiers}
                            selectedTickets={selectedTickets}
                            onQuantityChange={handleQuantityChange}
                            onContinue={handleContinueToCheckout}
                            onBack={() => navigate('details', 'back')}
                            total={calculatedTotal}
                            hasSelection={hasSelection}
                            primaryColor={event.primary_color}
                        />
                    </div>
                )}
                {view === 'addons' && (
                    <div className="animate-fade-in h-full">
                        <AddonsView
                            availableAddons={availableAddons}
                            selectedAddons={selectedAddons}
                            onAddonChange={handleAddonQuantityChange}
                            onContinue={() => navigate('checkout', 'forward')}
                            onBack={() => navigate('tickets', 'back')}
                            primaryColor={event.primary_color}
                        />
                    </div>
                )}
                {view === 'checkout' && (
                    <div className="animate-fade-in h-full">
                        <CheckoutFormView
                            guestName={guestName} setGuestName={setGuestName}
                            guestEmail={guestEmail} setGuestEmail={setGuestEmail}
                            guestPhone={guestPhone} setGuestPhone={setGuestPhone}
                            onBack={() => {
                                if (availableAddons && availableAddons.length > 0) {
                                    navigate('addons', 'back')
                                } else {
                                    navigate('tickets', 'back')
                                }
                            }}
                            onContinue={handleCreateReservation}
                            loading={loading}
                            primaryColor={event.primary_color}
                        />
                    </div>
                )}
                {view === 'summary' && (
                    <div className="animate-fade-in flex-1 min-h-0 flex flex-col h-full">
                        <SummaryView
                            event={event}
                            tiers={tiers}
                            selectedTickets={selectedTickets}
                            subtotal={calculatedTotal}
                            fees={platformFees}
                            total={totalDue}
                            timeLeft={timeLeft}
                            loading={loading}
                            onBack={() => navigate('checkout', 'back')}
                            onPay={handlePaystackPayment}
                            promoCode={promoCode}
                            setPromoCode={setPromoCode}
                            onApplyDiscount={applyPromoCode}
                            discount={discount}
                            discountError={discountError}
                            applyingDiscount={applyingDiscount}
                            primaryColor={event.primary_color}
                            availableAddons={availableAddons}
                            selectedAddons={selectedAddons}
                        />
                    </div>
                )}

                {/* Tap Hint for Mobile Collapsed - Moved to main container for better visibility */}
                {view === 'details' && !isExpanded && (
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-900 dark:via-zinc-900/95 flex flex-col justify-end items-center pb-6 md:hidden pointer-events-none z-20">
                        <span className="text-[12px] font-bold text-black dark:text-white mb-1 tracking-wide uppercase shadow-sm">Tap for details</span>
                        <ChevronDown className="w-5 h-5 text-black dark:text-white animate-bounce" />
                    </div>
                )}

                {view === 'success' && purchasedTickets.length > 0 && (
                    <div className="animate-scale-in">
                        <SuccessView
                            event={event}
                            tickets={purchasedTickets}
                            tierName={tiers.find(t => t.id === purchasedTickets[0].tier_id)?.name}
                        />
                    </div>
                )}
            </motion.div>
        </>
    )
}

// Sub-components

const DetailsView = ({ event, cheapestTier, onGetTickets, isExpanded, isFeedItem }: { event: Event, cheapestTier: TicketTier | null, onGetTickets: (e: any) => void, isExpanded: boolean, isFeedItem?: boolean }) => {
    const [activeSlide, setActiveSlide] = useState<'description' | 'host' | 'lineup'>('description')
    const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')
    const descriptionRef = React.useRef<HTMLDivElement>(null)
    const hostInfoRef = React.useRef<HTMLDivElement>(null)
    const lineupRef = React.useRef<HTMLDivElement>(null)

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
    }, [activeSlide, event.description, isExpanded])

    return (
        <div className="animate-fade-in flex flex-col h-full">
            {/* Header: Logo, Title, Host Name + Toggle, Price */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                    {/* Organizer Logo */}
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 border border-gray-100 dark:border-zinc-700 relative">
                        {event.logo_url ? (
                            <Image src={event.logo_url} alt="Logo" fill className="object-cover" />
                        ) : (
                            <span className="text-[10px]">{event.title?.substring(0, 2).toUpperCase() || 'GP'}</span>
                        )}
                    </div>

                    {/* Title & Host Toggle */}
                    <div>
                        <h2 className="text-[17px] font-bold text-black dark:text-white leading-none tracking-tight mb-0.5">{event.title}</h2>

                        {/* Interactive Host Name */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlide(activeSlide === 'host' ? 'description' : 'host');
                            }}
                            className="flex items-center gap-0.5 group outline-none"
                        >
                            <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">
                                {event.organizers?.name || 'GatePass Event'}
                            </p>
                            <ChevronRight
                                className={`w-3 h-3 text-gray-400 group-hover:text-black dark:group-hover:text-white transition-transform duration-300 ${activeSlide === 'host' ? 'rotate-90' : ''}`}
                            />
                        </button>
                    </div>
                </div>
                {cheapestTier && (
                    <div className="text-right">
                        <span className="block text-[16px] font-bold text-gray-400">
                            {formatCurrency(cheapestTier.price, cheapestTier.currency)}
                        </span>
                    </div>
                )}
            </div>

            {/* Sliding Content Container */}
            <div className={`transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${!isExpanded ? 'md:h-auto md:opacity-100' : 'opacity-100 h-auto'}`}>
                <div
                    className="relative overflow-hidden w-full transition-[height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    style={{ height: contentHeight === 'auto' ? 'auto' : `${contentHeight}px` }}
                >
                    {/* The Rail: Width 200% to hold both views side-by-side */}
                    <div
                        className="flex transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform w-[200%] items-start"
                        style={{ transform: activeSlide !== 'description' ? 'translateX(-50%)' : 'translateX(0)' }}
                    >
                        {/* Slide 1: Event Description */}
                        <div className="w-1/2 pr-4" ref={descriptionRef}>
                            <div
                                className={`text-[13px] font-normal text-black dark:text-gray-300 leading-relaxed mb-4 mt-2 prose prose-sm dark:prose-invert max-w-none ${!isExpanded ? 'overflow-hidden text-ellipsis line-clamp-3' : ''}`}
                                style={!isExpanded ? {
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                } : {}}
                                dangerouslySetInnerHTML={{ __html: event.description || '' }}
                            />

                            {/* Lineup Toggle Button */}
                            {event.lineup && event.lineup.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSlide('lineup');
                                    }}
                                    className="mt-5 mb-2 flex items-center gap-3 group outline-none transition-all active:scale-[0.98]"
                                >
                                    <div className="flex -space-x-2 overflow-hidden py-1">
                                        {event.lineup.slice(0, 3).map((item, i) => (
                                            <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-gray-100 dark:bg-zinc-800 overflow-hidden relative z-[1]">
                                                {item.image_url ? (
                                                    <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-gray-400">
                                                        {item.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {event.lineup.length > 3 && (
                                            <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center relative z-0">
                                                <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">+{event.lineup.length - 3}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[13px] font-medium text-black dark:text-white group-hover:underline decoration-gray-300 underline-offset-4 decoration-2">
                                        Lineup
                                    </span>
                                </button>
                            )}

                            {!isExpanded && activeSlide === 'description' && (
                                <span className="text-[11px] font-bold text-gray-400 block -mt-3 mb-2 md:hidden">Read more...</span>
                            )}
                        </div>

                        {/* Slide 2: Dynamic Content (Host OR Lineup) */}
                        <div className="w-1/2 pl-1 pr-4">
                            {activeSlide === 'host' && (
                                <div ref={hostInfoRef} className="mt-2 mb-4 animate-fade-in">
                                    <h3 className="text-[11px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-2">About the Host</h3>
                                    <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                                        {event.organizers?.description || 'No bio available.'}
                                    </p>

                                    {/* Organizer Socials */}
                                    {event.organizers && (
                                        <div className="flex items-center gap-3">
                                            {event.organizers.website && (
                                                <a href={event.organizers.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                                    <Globe className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                            {event.organizers.instagram && (
                                                <a href={`https://instagram.com/${event.organizers.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" display="none" /><rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2" /></svg>
                                                </a>
                                            )}
                                            {event.organizers.twitter && (
                                                <a href={`https://twitter.com/${event.organizers.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSlide === 'lineup' && (
                                <div ref={lineupRef} className="mt-2 mb-4 animate-fade-in">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[11px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">Lineup</h3>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveSlide('description') }}
                                            className="text-[10px] font-bold text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                                        >
                                            <ArrowLeft className="w-3 h-3" /> Back
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {(event.lineup || []).map((item, i) => (
                                            <div key={i} className="flex flex-col items-center text-center">
                                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden mb-2 relative">
                                                    {item.image_url ? (
                                                        <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                            {item.name.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-bold leading-tight text-black dark:text-white w-full break-words">{item.name}</div>
                                                <div className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{item.role}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Persistent Date/Location */}
            <div className="flex flex-col gap-3 mb-5 mt-auto">
                <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 2V6" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 2V6" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 10H21" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-[13px] font-medium text-black dark:text-white leading-tight">
                        {(() => {
                            const startDate = new Date(event.starts_at)
                            const endDate = event.ends_at ? new Date(event.ends_at) : null

                            let dateString = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

                            if (endDate) {
                                const isSameDay = startDate.getDate() === endDate.getDate() &&
                                    startDate.getMonth() === endDate.getMonth() &&
                                    startDate.getFullYear() === endDate.getFullYear()

                                const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

                                if (isSameDay) {
                                    return `${dateString} • ${startTime} - ${endTime}`
                                } else {
                                    const endDateString = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    return `${dateString}, ${startTime} - ${endDateString}, ${endTime}`
                                }
                            }

                            return `${dateString} • ${startTime}`
                        })()}
                    </span>
                </div>
                <div className={`flex items-start gap-3 transition-opacity duration-300 ${!isExpanded ? 'opacity-0 h-0 overflow-hidden md:opacity-100 md:h-auto' : 'opacity-100'}`}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-black dark:text-white leading-tight mb-0.5">{event.venue_name}</span>
                        <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight">{event.venue_address}</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onGetTickets}
                style={{ backgroundColor: event.primary_color || '#000000', color: '#ffffff' }}
                className={`w-full h-10 rounded-lg text-[13px] font-bold tracking-wide transition-all active:scale-[0.98] shadow-lg ${!isExpanded ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'}`}>
                Get Tickets
            </button>
            <div className={`flex justify-end mt-3 transition-opacity duration-300 ${!isExpanded ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Powered by GatePass</span>
            </div>
        </div >
    )
}

const TicketCard = ({ tier, qty, onQuantityChange, primaryColor }: { tier: TicketTier, qty: number, onQuantityChange: (id: string, delta: number) => void, primaryColor?: string }) => {
    const [showPerks, setShowPerks] = useState(false)
    const isSelected = qty > 0
    const isSoldOut = tier.quantity_sold >= tier.total_quantity
    const remaining = tier.total_quantity - tier.quantity_sold
    const isLowStock = remaining > 0 && remaining <= 10
    const hasPerks = tier.perks && tier.perks.length > 0
    const themeColor = primaryColor || '#000000'

    return (
        <div
            style={isSelected ? { backgroundColor: themeColor, color: '#ffffff' } : {}}
            className={`
                relative flex-shrink-0 w-[85%] md:w-[280px] rounded-2xl p-5 flex flex-col justify-between
                transition-all duration-300 snap-center min-h-[320px]
                ${isSelected
                    ? 'scale-[1.02] ring-0 shadow-xl'
                    : 'bg-white text-black dark:bg-zinc-900 dark:text-white ring-1 ring-black/5 dark:ring-white/10'
                }
            `}
        >
            {isLowStock && (
                <div className="absolute top-3 right-3 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1.5 z-10 shadow-sm">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                    Only {remaining} left
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <div className={`text-[24px] font-bold leading-none mb-2 tracking-tighter ${isSelected ? 'text-white' : 'text-black dark:text-white'}`}>
                        {formatCurrency(tier.price, tier.currency)}
                    </div>
                    <div className={`text-[15px] font-bold leading-tight ${isSelected ? 'text-white/90' : 'text-gray-900 dark:text-white'}`}>{tier.name}</div>
                </div>

                {tier.description && (
                    <p className={`text-[13px] leading-relaxed ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                        {tier.description}
                    </p>
                )}

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

            <div className={`mt-6 flex items-center justify-between px-1 py-1 rounded-full ${isSelected ? 'bg-black/20' : 'bg-gray-50 dark:bg-zinc-800'}`}>
                <button
                    onClick={() => onQuantityChange(tier.id, -1)}
                    disabled={qty === 0}
                    className={`w-10 h-10 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-black/20 text-white' : 'hover:bg-white text-black dark:text-white dark:hover:bg-zinc-700'}`}
                >
                    -
                </button>
                <span className={`font-bold text-lg min-w-[20px] text-center ${isSelected ? 'text-white' : 'text-black dark:text-white'}`}>{qty}</span>
                <button
                    onClick={() => onQuantityChange(tier.id, 1)}
                    disabled={isSoldOut}
                    className={`w-10 h-10 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-black/20 text-white' : 'hover:bg-white text-black dark:text-white dark:hover:bg-zinc-700'}`}
                >
                    +
                </button>
            </div>
        </div>
    )
}

const TicketsView = ({ tiers, selectedTickets, onQuantityChange, onContinue, onBack, total, hasSelection, primaryColor }: {
    tiers: TicketTier[],
    selectedTickets: Record<string, number>,
    onQuantityChange: (tierId: string, delta: number) => void,
    onContinue: () => void,
    onBack: () => void,
    total: number,
    hasSelection: boolean,
    primaryColor?: string
}) => (
    <div className="flex flex-col h-auto animate-fade-in relative">
        <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-[18px] font-bold tracking-tight text-black dark:text-white">Select Tickets</h2>
            <button onClick={onBack} className="p-2 -mr-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <div className="-mx-4 px-5 overflow-x-auto flex gap-4 items-stretch pb-8 no-scrollbar snap-x snap-mandatory">
            {tiers.map((tier) => (
                <TicketCard
                    key={tier.id}
                    tier={tier}
                    qty={selectedTickets[tier.id] || 0}
                    onQuantityChange={onQuantityChange}
                    primaryColor={primaryColor}
                />
            ))}
        </div>

        {/* Sticky Footer with Total */}
        <div className={`
                sticky bottom-0 -mx-4 -mb-4 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-10
                md:static md:bg-transparent md:border-0 md:backdrop-filter-none md:p-0 md:mt-8 md:mx-0 md:mb-0
                transition-transform duration-300
                ${hasSelection ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
            <div className="max-w-md mx-auto md:max-w-none">
                <button
                    onClick={onContinue}
                    disabled={!hasSelection}
                    style={{ backgroundColor: hasSelection ? (primaryColor || '#000000') : undefined, color: '#ffffff' }}
                    className="w-full h-10 rounded-lg text-[13px] font-bold tracking-wide disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-between px-4 shadow-lg bg-black dark:bg-zinc-800"

                >
                    <span>Checkout</span>
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

const CheckoutFormView = ({ guestName, setGuestName, guestEmail, setGuestEmail, guestPhone, setGuestPhone, onBack, onContinue, loading, primaryColor }: {
    guestName: string, setGuestName: (name: string) => void,
    guestEmail: string, setGuestEmail: (email: string) => void,
    guestPhone: string, setGuestPhone: (phone: string) => void,
    onBack: () => void,
    onContinue: () => void,
    loading: boolean,
    primaryColor?: string
}) => (
    <div className="flex flex-col h-auto animate-fade-in relative">
        <div className="flex justify-between items-center mb-8 px-1">
            <h2 className="text-[18px] font-bold tracking-tight text-black dark:text-white">Your Details</h2>
            <button onClick={onBack} className="p-2 -mr-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <div className="space-y-5 px-1 pb-4">
            <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 dark:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-700 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all text-black dark:text-white text-[16px] placeholder:text-gray-400 font-medium"
                />
            </div>

            <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 dark:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-700 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all text-black dark:text-white text-[16px] placeholder:text-gray-400 font-medium"
                />
                <p className="text-[11px] text-gray-400 px-1">We'll send your tickets here.</p>
            </div>

            <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
                <input
                    type="tel"
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    placeholder="+233"
                    className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 dark:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-700 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 transition-all text-black dark:text-white text-[16px] placeholder:text-gray-400 font-medium"
                />
            </div>
        </div>

        {/* Sticky Footer for Form */}
        <div className="sticky bottom-0 -mx-4 -mb-4 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-10 md:static md:bg-transparent md:border-0 md:backdrop-filter-none md:p-0 md:mt-8 md:mx-0 md:mb-0">
            <div className="max-w-md mx-auto md:max-w-none">
                <button
                    onClick={onContinue}
                    disabled={loading || !guestName || !guestEmail}
                    style={{
                        backgroundColor: (!loading && guestName && guestEmail) ? (primaryColor || undefined) : undefined,
                        color: (!loading && guestName && guestEmail && primaryColor) ? getContrastColor(primaryColor) : undefined
                    }}
                    className="w-full bg-black dark:bg-white text-white dark:text-black h-10 rounded-lg text-[13px] font-bold tracking-wide hover:bg-gray-900 dark:hover:bg-gray-200 disabled:opacity-100 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? 'Processing...' : 'Continue to Payment'}
                    {!loading && <svg className="w-4 h-4 text-gray-400 dark:text-zinc-600 group-disabled:text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
                </button>
            </div>
        </div>
    </div>
)

const AddonsView = ({ availableAddons, selectedAddons, onAddonChange, onContinue, onBack, primaryColor }: {
    availableAddons: any[],
    selectedAddons: Record<string, number>,
    onAddonChange: (addonId: string, delta: number) => void,
    onContinue: () => void,
    onBack: () => void,
    primaryColor?: string
}) => {
    const hasSelection = Object.values(selectedAddons).some(qty => qty > 0)

    return (
        <div className="flex flex-col h-full animate-fade-in relative bg-gray-50/50 dark:bg-black/20">
            <div className="flex justify-between items-center mb-4 px-1 flex-shrink-0 pt-1">
                <div className="space-y-0.5">
                    <h2 className="text-[20px] font-bold tracking-tight text-black dark:text-white">Enhance your experience</h2>
                    <p className="text-[13px] text-gray-500 font-medium">Add extras to your order</p>
                </div>
                <button onClick={onBack} className="p-2 -mr-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors bg-white dark:bg-zinc-800 rounded-full border border-gray-100 dark:border-white/10 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar -mx-4 px-4 pb-20">
                <div className="space-y-4">
                    {availableAddons.map((addon) => {
                        const qty = selectedAddons[addon.id] || 0
                        const isSelected = qty > 0

                        return (
                            <div
                                key={addon.id}
                                className={cn(
                                    "group relative overflow-hidden rounded-[20px] border bg-white dark:bg-zinc-900 transition-all duration-300",
                                    isSelected
                                        ? "border-black dark:border-white shadow-lg shadow-black/5 dark:shadow-white/5 ring-1 ring-black dark:ring-white"
                                        : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 shadow-sm"
                                )}
                            >
                                <div className="flex p-4 gap-4">
                                    {/* Image */}
                                    <div className="w-24 h-24 bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0 relative border border-black/5 dark:border-white/5">
                                        {addon.image_url ? (
                                            <Image src={addon.image_url} alt={addon.name} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800">
                                                <BadgeCheck className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
                                            </div>
                                        )}
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-black/10 dark:bg-white/10 z-10" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                                        <div>
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                <h4 className="text-[16px] font-bold text-black dark:text-white leading-tight">{addon.name}</h4>
                                                <span className="font-bold text-[15px] tabular-nums whitespace-nowrap bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-md text-black dark:text-white">
                                                    {formatCurrency(addon.price, addon.currency)}
                                                </span>
                                            </div>
                                            {addon.description && (
                                                <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed">{addon.description}</p>
                                            )}
                                        </div>

                                        {/* Controls */}
                                        <div className="flex items-end justify-between mt-3">
                                            <div className="text-[11px] font-medium text-gray-400">
                                                {qty > 0 ? (
                                                    <span className="text-black dark:text-white flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> Added
                                                    </span>
                                                ) : (
                                                    <span>Optional</span>
                                                )}
                                            </div>

                                            <div className={cn(
                                                "flex items-center gap-3 p-1 rounded-xl transition-colors",
                                                isSelected ? "bg-black text-white dark:bg-white dark:text-black" : "bg-gray-100 dark:bg-zinc-800 text-black dark:text-white"
                                            )}>
                                                <button
                                                    onClick={() => onAddonChange(addon.id, -1)}
                                                    disabled={qty === 0}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-all font-bold"
                                                >
                                                    -
                                                </button>
                                                <span className="text-[14px] font-bold tabular-nums w-5 text-center">{qty}</span>
                                                <button
                                                    onClick={() => onAddonChange(addon.id, 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className={`
                sticky bottom-0 -mx-4 -mb-4 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-10
                md:static md:bg-transparent md:border-0 md:backdrop-filter-none md:p-0 md:mt-4 md:mx-0 md:mb-0
            `}>
                <div className="max-w-md mx-auto md:max-w-none">
                    <button
                        onClick={onContinue}
                        style={{ backgroundColor: hasSelection ? (primaryColor || undefined) : undefined }}
                        className={cn(
                            "w-full h-12 rounded-xl text-[14px] font-bold tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-black/10 flex items-center justify-center gap-2 border",
                            hasSelection
                                ? "bg-black dark:bg-white text-white dark:text-black hover:opacity-90 border-transparent"
                                : "bg-white dark:bg-zinc-900 text-black dark:text-white border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        )}
                    >
                        {hasSelection ? 'Continue with Add-ons' : 'No Thanks, Continue'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
const SummaryView = ({ event, tiers, subtotal, fees, total, timeLeft, loading, onBack, onPay, promoCode, setPromoCode, onApplyDiscount, discount, discountError, applyingDiscount, selectedTickets, primaryColor, availableAddons = [], selectedAddons = {} }: {
    event: Event,
    tiers: TicketTier[],
    subtotal: number,
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
    timeLeft: { label: string, seconds: number },
    primaryColor?: string,
    availableAddons?: any[],
    selectedAddons?: Record<string, number>
}) => {
    const [showPromo, setShowPromo] = useState(false)

    // Dynamic Timer Color
    // Default: Black
    // < 5 mins (300s): Yellow
    // < 2.5 mins (150s): Red
    let timerColor = "bg-black/80 backdrop-blur-md text-white border-white/10"
    let dotColor = "bg-green-400 animate-pulse"

    if (timeLeft.seconds <= 150) {
        timerColor = "bg-red-500 text-white border-red-400"
        dotColor = "bg-white animate-pulse"
    } else if (timeLeft.seconds <= 300) {
        timerColor = "bg-yellow-400 text-black border-yellow-300"
        dotColor = "bg-black animate-pulse"
    }

    return (
        <div className="flex flex-col h-full flex-1 min-h-0 animate-fade-in relative">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar -mx-4 px-4 pb-4">
                {/* Immersive Timer */}
                <div className="flex justify-center mb-4 sticky top-4 z-20 pointer-events-none">
                    <div className={`${timerColor} py-2 px-4 rounded-full text-[12px] font-medium shadow-xl flex items-center gap-2 border animate-fade-in-down transition-colors duration-500`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${timeLeft.label === 'EXPIRED' ? 'bg-red-500' : dotColor}`} />
                        <span>Reservation expires in <span className="font-mono tracking-wider font-bold">{timeLeft.label}</span></span>
                    </div>
                </div>

                <div className="px-1 mt-0 mb-2">
                    <button onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors -ml-1 py-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        <span className="text-[13px] font-bold">Back</span>
                    </button>
                    <h2 className="text-[18px] font-bold tracking-tight mt-1 text-black dark:text-white">Order Summary</h2>
                </div>

                {/* Receipt Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-0 border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm relative mx-1">
                    {/* Visual Header */}
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-6 border-b border-gray-100 dark:border-zinc-800">
                        <h3 className="text-[16px] font-bold leading-tight text-black dark:text-white">{event.title}</h3>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Ticket Breakdown */}
                        <div className="space-y-3">
                            {tiers.map(tier => {
                                const qty = selectedTickets[tier.id] || 0
                                if (qty === 0) return null
                                return (
                                    <div key={tier.id} className="flex justify-between items-center text-[13px] text-gray-500 dark:text-gray-400">
                                        <span>{tier.name} <span className="text-[11px] ml-1">x{qty}</span></span>
                                        <span className="font-medium text-black dark:text-white">{formatCurrency(tier.price * qty, tier.currency)}</span>
                                    </div>
                                )
                            })}

                            {/* Addons Breakdown */}
                            {selectedAddons && Object.keys(selectedAddons).length > 0 && availableAddons && (
                                <div className="pt-2 mt-2 border-t border-dashed border-gray-100 dark:border-zinc-800 space-y-2">
                                    {Object.entries(selectedAddons).map(([addonId, qty]) => {
                                        if (qty === 0) return null
                                        const addon = availableAddons.find(a => a.id === addonId)
                                        if (!addon) return null
                                        return (
                                            <div key={addonId} className="flex justify-between items-center text-[13px] text-gray-500 dark:text-gray-400">
                                                <span>{addon.name} <span className="text-[11px] ml-1">x{qty}</span></span>
                                                <span className="font-medium text-black dark:text-white">{formatCurrency(addon.price * qty, addon.currency)}</span>
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
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal, tiers[0]?.currency)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 dark:text-gray-400">Fees</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(fees, tiers[0]?.currency)}</span>
                            </div>

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

                        {/* Promo Input */}
                        {!discount && (
                            <div className="pt-1">
                                {!showPromo ? (
                                    <button
                                        onClick={() => setShowPromo(true)}
                                        className="text-[13px] text-gray-500 dark:text-gray-400 font-medium hover:text-black dark:hover:text-white transition-colors flex items-center gap-2 group"
                                    >
                                        <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center group-hover:border-gray-400 dark:group-hover:border-zinc-500 transition-colors">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                        </div>
                                        Add promo code
                                    </button>
                                ) : (
                                    <div className="animate-fade-in">
                                        <div className="flex gap-2">
                                            <input
                                                value={promoCode}
                                                onChange={(e) => setPromoCode(e.target.value)}
                                                placeholder="Enter promo code"
                                                className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-[13px] px-3 py-2 uppercase placeholder:normal-case focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white outline-none transition-all text-black dark:text-white"
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
                                                className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-[12px] font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                                            >
                                                {applyingDiscount ? '...' : 'Apply'}
                                            </button>
                                            <button
                                                onClick={() => setShowPromo(false)}
                                                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        {discountError && <p className="text-red-500 text-[11px] mt-1.5 font-medium ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{discountError}</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border-t border-dashed border-gray-200 dark:border-zinc-800 pt-2" />

                        <div className="flex justify-between items-end">
                            <span className="text-[15px] font-bold text-gray-900 dark:text-white">Total Due</span>
                            <div className="text-right">
                                <span className="text-[24px] font-bold text-black dark:text-white leading-none tracking-tight block">{formatCurrency(total, tiers[0]?.currency)}</span>
                                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Incl. taxes & fees</span>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Terms */}
                <p className="text-center text-[10px] text-gray-400 mt-4 px-8 leading-relaxed mb-4">
                    By purchasing, you agree to the <a href="#" className="underline hover:text-gray-500">Terms of Service</a> and <a href="#" className="underline hover:text-gray-500">Privacy Policy</a>.
                    All sales are final.
                </p>
            </div>

            {/* Static Footer (Flex Item) */}
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 p-4 -mx-4 -mb-4 z-30 flex-shrink-0">
                <div className="max-w-md mx-auto md:max-w-none">
                    <button
                        onClick={onPay}
                        disabled={loading || timeLeft.label === 'EXPIRED'}
                        style={{
                            backgroundColor: primaryColor || undefined,
                            color: primaryColor ? getContrastColor(primaryColor) : '#ffffff'
                        }}
                        className="w-full bg-black dark:bg-white text-white dark:text-black h-12 rounded-xl text-[14px] font-bold tracking-wide hover:bg-gray-900 dark:hover:bg-gray-200 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-black/10 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                        ) : (
                            <>Pay {formatCurrency(total, tiers[0]?.currency)}</>
                        )}
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
}

const SuccessView = ({ event, tickets, tierName }: { event: Event, tickets: any[], tierName: string | undefined }) => {
    const [downloading, setDownloading] = useState(false)
    const activeTicket = tickets[0] // Primary ticket for QR (or handle multiple via swipe if needed, for now sticking to order summary style with first QR)

    const handleDownloadPDF = async () => {
        if (!tickets || tickets.length === 0) return
        const reservationId = tickets[0].reservation_id
        if (!reservationId) {
            toast.error('Reservation ID missing')
            return
        }

        setDownloading(true)
        // Redirect to API
        window.location.href = `/api/reservations/${reservationId}/download`

        // Reset loading state
        setTimeout(() => setDownloading(false), 2000)
    }

    // Confetti Effect
    useEffect(() => {
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
    }, [])

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

    // Enhanced Utilities
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name} ${event.venue_address}`)}`

    // Generate Google Calendar Link
    const getGoogleCalendarUrl = () => {
        const start = new Date(event.starts_at)
        // Assume 2 hour duration if no end time (fixme: real end time if available)
        const end = new Date(start.getTime() + (2 * 60 * 60 * 1000))

        const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "")

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatTime(start)}/${formatTime(end)}&details=${encodeURIComponent(`Tickets: ${window.location.href}`)}&location=${encodeURIComponent(event.venue_name)}`
    }

    // Countdown Logic
    const getCountdown = () => {
        const diff = new Date(event.starts_at).getTime() - Date.now()
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

        if (days < 0) return null // Event started/past
        if (days === 0) return "Starts Today!"
        if (days === 1) return "Starts Tomorrow!"
        return `Starts in ${days} Days`
    }

    const countdownText = getCountdown()

    // Aggregate Ticket Counts
    const ticketCounts = tickets.reduce((acc, ticket) => {
        // Access nested tier name properly if available, or use the passed tierName prop as fallback
        const name = ticket.ticket_tiers?.name || tierName || 'General Admission'
        acc[name] = (acc[name] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-[24px] overflow-hidden relative animate-fade-in">
            {/* Header / Dismiss */}
            <div className="flex-shrink-0 px-5 pt-5 pb-2 flex justify-between items-start">
                <div className="space-y-1">
                    <h2 className="text-[18px] leading-tight font-extrabold tracking-tight text-black dark:text-white max-w-[200px]">
                        See you at {event.title}!🎉
                    </h2>
                    {countdownText && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-wide">
                            {countdownText}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="p-1.5 -mr-1.5 -mt-1.5 text-black dark:text-white hover:opacity-70 transition-opacity"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-5">

                {/* QR Code */}
                <div className="flex flex-col items-center my-6">
                    <div className="bg-white p-2 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-3">
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

                {/* Ticket Details Card */}
                <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-[20px] p-3 space-y-3">
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
            <div className="p-6 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-white/5">
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={downloading}
                        className="w-full h-14 bg-black dark:bg-white text-white dark:text-black rounded-[20px] text-[15px] font-bold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3"
                    >
                        {downloading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
                                <Download className="w-4 h-4" />
                            </div>
                        )}
                        {downloading ? 'Preparing Tickets...' : 'Download PDF Tickets'}
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={handleShare}
                            className="flex-1 h-12 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl text-[13px] font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                        <a
                            href={getGoogleCalendarUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 h-12 bg-zinc-50 dark:bg-zinc-800/50 text-black dark:text-white border border-gray-200 dark:border-zinc-700 rounded-2xl text-[13px] font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
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
