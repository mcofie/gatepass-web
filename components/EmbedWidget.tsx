'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Event, TicketTier, EventAddon, Discount } from '@/types/gatepass'
import { FeeRates, calculateFees, getEffectiveFeeRates } from '@/utils/fees'
import { createClient } from '@/utils/supabase/client'
import { createReservation } from '@/utils/gatepass'
import { toast, Toaster } from 'sonner'
import {
    Loader2, ArrowLeft, Ticket, Check, X, CreditCard,
    ChevronRight, Calendar, MapPin, ChevronUp, ChevronDown,
    Plus, Minus, ShoppingBag, ExternalLink, Share2, ArrowRight,
    Download
} from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { cn, getContrastColor } from '@/lib/utils'

// --- Animation Variants ---
const pageVariants: Variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: "easeIn" } }
}

const itemVariants: Variants = {
    initial: { opacity: 0, y: 10 },
    animate: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" }
    })
}

// --- Component: TicketCard ---
const TicketCard = ({ tier, qty, onQuantityChange, primaryColor }: { tier: TicketTier, qty: number, onQuantityChange: (id: string, delta: number) => void, primaryColor?: string }) => {
    const [showPerks, setShowPerks] = useState(false)
    const isSelected = qty > 0
    const isSoldOut = tier.quantity_sold >= tier.total_quantity
    const remaining = tier.total_quantity - tier.quantity_sold
    const isLowStock = remaining > 0 && remaining <= 10
    const hasPerks = tier.perks && tier.perks.length > 0
    const themeColor = primaryColor || '#000000'

    return (
        <motion.div
            layout
            style={isSelected ? { backgroundColor: themeColor, color: '#ffffff' } : {}}
            className={`
                relative flex-shrink-0 w-full rounded-2xl p-5 flex flex-col justify-between
                transition-all duration-300 min-h-[220px]
                ${isSelected
                    ? 'ring-0 shadow-xl'
                    : 'bg-white text-black ring-1 ring-black/5'
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
                    <div className={`text-[24px] font-bold leading-none mb-2 tracking-tighter ${isSelected ? 'text-white' : 'text-black'}`}>
                        {formatCurrency(tier.price, tier.currency)}
                    </div>
                    <div className={`text-[15px] font-bold leading-tight ${isSelected ? 'text-white/90' : 'text-gray-900'}`}>{tier.name}</div>
                </div>

                {tier.description && (
                    <p className={`text-[13px] leading-relaxed ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                        {tier.description}
                    </p>
                )}

                <div className={`h-px w-full ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`} />

                {hasPerks ? (
                    <div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowPerks(!showPerks); }}
                            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2 hover:opacity-80 transition-opacity ${isSelected ? 'text-white/70' : 'text-gray-500'}`}
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
                                        <span className={isSelected ? 'text-white/90' : 'text-gray-600'}>{perk}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="h-4" />
                )}
            </div>

            <div className={`mt-6 flex items-center justify-between px-1 py-1 rounded-full ${isSelected ? 'bg-black/20' : 'bg-gray-50'}`}>
                <button
                    onClick={() => onQuantityChange(tier.id, -1)}
                    disabled={qty === 0}
                    className={`w-10 h-10 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-black/20 text-white' : 'hover:bg-white text-black'}`}
                >
                    -
                </button>
                <span className={`font-bold text-lg min-w-[20px] text-center ${isSelected ? 'text-white' : 'text-black'}`}>{qty}</span>
                <button
                    onClick={() => onQuantityChange(tier.id, 1)}
                    disabled={isSoldOut}
                    className={`w-10 h-10 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-black/20 text-white' : 'hover:bg-white text-black'}`}
                >
                    +
                </button>
            </div>
        </motion.div>
    )
}

// --- Component: AddonCard ---
const AddonCard = ({ addon, qty, onQuantityChange, index, primaryColor }: { addon: EventAddon, qty: number, onQuantityChange: (id: string, delta: number) => void, index: number, primaryColor?: string }) => {
    const isSelected = qty > 0
    const remaining = (addon.total_quantity !== null && addon.total_quantity !== undefined)
        ? Math.max(0, addon.total_quantity - addon.quantity_sold)
        : Infinity
    const isSoldOut = remaining <= 0
    const isMaxed = qty >= remaining

    return (
        <motion.div
            custom={index}
            variants={itemVariants}
            initial="initial"
            animate="animate"
            className={cn(
                "group relative overflow-hidden rounded-[24px] border transition-all duration-500",
                isSoldOut ? "bg-gray-50/50 border-gray-100 opacity-60" :
                    isSelected
                        ? "border-transparent shadow-2xl scale-[1.01]"
                        : "bg-gray-50/50 border-transparent hover:bg-gray-100 shadow-sm"
            )}
            style={isSelected && !isSoldOut ? {
                backgroundColor: primaryColor || '#000000',
                color: getContrastColor(primaryColor || '#000000'),
            } : {}}
        >
            <div className="flex p-4 gap-4">
                {/* Elevated Image Container */}
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 relative bg-white shadow-sm border border-black/5">
                    {addon.image_url ? (
                        <Image src={addon.image_url} alt={addon.name} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <ShoppingBag className="w-8 h-8 text-gray-400" />
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
                                isSelected ? "text-current" : "text-black"
                            )}>{addon.name}</h4>
                            <span className={cn(
                                "font-bold text-[14px] tabular-nums",
                                isSelected ? "opacity-80" : "text-gray-400"
                            )}>
                                {formatCurrency(addon.price, addon.currency)}
                            </span>
                        </div>
                        {addon.description && (
                            <p className={cn(
                                "text-[12px] line-clamp-2 leading-snug font-medium",
                                isSelected ? "opacity-60" : "text-gray-500"
                            )}>{addon.description}</p>
                        )}
                    </div>

                    {/* Interaction Bar */}
                    <div className="flex items-center justify-between mt-3">
                        <div className={cn(
                            "text-[9px] font-black uppercase tracking-[0.15em]",
                            isSelected ? "opacity-40" : "text-gray-400"
                        )}>
                            {isSoldOut ? "Unavailable" : isSelected ? "In Cart" : "Optional"}
                        </div>

                        {!isSoldOut && (
                            <div className="flex items-center gap-1.5 transition-all">
                                {addon.selection_type === 'toggle' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onQuantityChange(addon.id, isSelected ? -qty : 1); }}
                                        className={cn(
                                            "h-8 px-4 rounded-full transition-all text-[12px] font-bold flex items-center justify-center gap-1.5",
                                            isSelected
                                                ? "bg-white/20 text-current hover:bg-white/30"
                                                : "bg-black text-white hover:opacity-90 shadow-sm"
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
                                        isSelected ? "bg-white/10" : "bg-white shadow-sm border border-black/5"
                                    )}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onQuantityChange(addon.id, -1); }}
                                            disabled={qty === 0}
                                            className={cn(
                                                "w-8 h-8 flex items-center justify-center rounded-full transition-all text-xl font-medium",
                                                isSelected ? "hover:bg-white/10 text-current" : "hover:bg-gray-100 text-black"
                                            )}
                                        >
                                            -
                                        </button>
                                        <span className={cn(
                                            "text-[14px] font-extrabold tabular-nums w-4 text-center",
                                            isSelected ? "text-current" : "text-black"
                                        )}>{qty}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onQuantityChange(addon.id, 1); }}
                                            disabled={isMaxed}
                                            className={cn(
                                                "w-8 h-8 flex items-center justify-center rounded-full transition-all text-xl font-medium",
                                                isSelected ? "hover:bg-white/10 text-current" : "hover:bg-gray-100 text-black"
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
        </motion.div>
    )
}

interface EmbedWidgetProps {
    event: Event
    cheapestTier: TicketTier | null
    tiers: TicketTier[]
    feeRates?: FeeRates
    availableAddons?: EventAddon[]
}

export function EmbedWidget({ event, cheapestTier, tiers, feeRates, availableAddons = [] }: EmbedWidgetProps) {
    const [view, setView] = useState<'details' | 'tickets' | 'addons' | 'checkout' | 'summary' | 'success'>('details')
    const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({})
    const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)
    const [guestName, setGuestName] = useState('')
    const [guestEmail, setGuestEmail] = useState('')
    const [guestPhone, setGuestPhone] = useState('')
    const [purchasedTickets, setPurchasedTickets] = useState<any[]>([])
    const [verifying, setVerifying] = useState(false)
    const [timeLeft, setTimeLeft] = useState(600)
    const [detailsSlide, setDetailsSlide] = useState<'description' | 'host' | 'lineup'>('description')

    // Discount State
    const [promoCode, setPromoCode] = useState('')
    const [discount, setDiscount] = useState<Discount | null>(null)
    const [discountError, setDiscountError] = useState('')
    const [applyingDiscount, setApplyingDiscount] = useState(false)
    const [showPromo, setShowPromo] = useState(false)

    // Timer Effect
    useEffect(() => {
        if (view === 'summary' && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
            return () => clearInterval(timer)
        }
    }, [view, timeLeft])

    const formattedTime = (() => {
        const m = Math.floor(timeLeft / 60)
        const s = timeLeft % 60
        return `${m}m ${s}s`
    })()

    // Confetti on success
    useEffect(() => {
        if (view === 'success') {
            const colors = ['#000000', '#FFD700', '#ffffff']
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: colors
            })
        }
    }, [view])

    // Force transparent background for embed
    useEffect(() => {
        document.body.style.background = 'transparent'
        document.documentElement.style.background = 'transparent'
        return () => {
            document.body.style.background = ''
            document.documentElement.style.background = ''
        }
    }, [])

    // Payment Verification Logic
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const reference = searchParams.get('reference') || searchParams.get('trxref')
        const callbackEventId = searchParams.get('event_id')

        if (reference && callbackEventId === event.id) {
            const verifyPayment = async () => {
                setVerifying(true)
                try {
                    const response = await fetch('/api/paystack/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference, reservationId: reference })
                    })
                    const result = await response.json()

                    if (!result.success && result.error !== 'Transaction reference not found') {
                        throw new Error(result.error || 'Verification failed')
                    }

                    setPurchasedTickets(result.tickets || [])
                    setView('success')
                    window.history.replaceState({}, '', window.location.pathname)
                } catch (error: any) {
                    console.error('Verification Error:', error)
                    toast.error(error.message)
                } finally {
                    setVerifying(false)
                }
            }
            verifyPayment()
        }
    }, [event.id])


    // Handlers
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

            // Check inventory limit
            const addon = availableAddons.find(a => a.id === addonId)
            if (addon && addon.total_quantity !== null && addon.total_quantity !== undefined) {
                const remaining = Math.max(0, addon.total_quantity - addon.quantity_sold)
                if (intent > remaining) {
                    toast.error('Not enough stock for this addon')
                    return prev
                }
            }
            return { ...prev, [addonId]: intent }
        })
    }

    // Apply Promo Code
    const handleApplyDiscount = async () => {
        if (!promoCode) return
        setApplyingDiscount(true)
        setDiscountError('')
        const supabase = createClient()

        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('discounts')
                .select('*')
                .eq('code', promoCode.toUpperCase())
                .eq('event_id', event.id)
                .single()

            if (error || !data) throw new Error('Invalid code')

            // Check expiry
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                throw new Error('Code expired')
            }
            // Check usage
            if (data.max_uses && data.used_count >= data.max_uses) {
                throw new Error('Code limit reached')
            }
            // Check Tier match if applicable
            // Note: In refined logic we might want to ensure selected tickets match discount tier. 
            // For now we assume general or check if tier_id is null or in selected.

            setDiscount(data as Discount)
            toast.success('Promo code applied!')
            setShowPromo(false) // Collapse input
        } catch (err: any) {
            setDiscountError(err.message || 'Invalid code')
            setDiscount(null)
        } finally {
            setApplyingDiscount(false)
        }
    }


    // Calculation Logic
    const calculateFinancials = () => {
        const ticketItems = Object.entries(selectedTickets).filter(([_, qty]) => qty > 0)
        let ticketSubtotal = 0
        ticketItems.forEach(([id, qty]) => {
            const tier = tiers.find(t => t.id === id)
            if (tier) ticketSubtotal += tier.price * qty
        })

        const addonItems = Object.entries(selectedAddons).filter(([_, qty]) => qty > 0)
        let addonSubtotal = 0
        addonItems.forEach(([id, qty]) => {
            const addon = availableAddons.find(a => a.id === id)
            if (addon) addonSubtotal += addon.price * qty
        })

        // Apply Discount
        let discountedTicketSubtotal = ticketSubtotal
        if (discount) {
            if (discount.type === 'fixed') {
                // Fixed amount off total tickets
                discountedTicketSubtotal = Math.max(0, ticketSubtotal - discount.value)
            } else {
                // Percentage off
                discountedTicketSubtotal = Math.max(0, ticketSubtotal * (1 - discount.value / 100))
            }
        }

        const totalSubtotal = discountedTicketSubtotal + addonSubtotal
        const effectiveRates = getEffectiveFeeRates(feeRates, event)
        const { customerTotal } = calculateFees(totalSubtotal, 0, event.fee_bearer as 'customer' | 'organizer', effectiveRates)
        const fees = Math.max(0, customerTotal - totalSubtotal)

        return { subtotal: totalSubtotal, ticketSubtotal, addonSubtotal, fees, total: customerTotal, discountAmount: ticketSubtotal - discountedTicketSubtotal }
    }

    // Step 1 of Booking: Create Reservation
    const handleCreateReservation = async () => {
        if (!guestEmail || !guestName) {
            toast.error('Please fill in your details')
            return
        }

        setLoading(true)
        try {
            const tiersToBook = Object.entries(selectedTickets)
                .filter(([_, qty]) => qty > 0)
                .map(([tierId, qty]) => ({ tierId, qty }))

            if (tiersToBook.length === 0) throw new Error('No tickets selected')

            const supabase = createClient()
            const cleanedAddons = Object.fromEntries(
                Object.entries(selectedAddons).filter(([_, qty]) => qty > 0)
            )

            const createdDocs = await Promise.all(tiersToBook.map(async (item, idx) => {
                const addonsToSend = idx === 0 ? cleanedAddons : {}
                return createReservation(
                    event.id,
                    item.tierId,
                    null,
                    item.qty,
                    supabase,
                    { email: guestEmail, name: guestName, phone: guestPhone },
                    discount?.id, // Pass Discount ID
                    addonsToSend
                )
            }))

            const validDocs = createdDocs.filter(d => d && d.id)
            if (validDocs.length === 0) throw new Error('Failed to create reservations')

            setPurchasedTickets(validDocs) // Store temporarily as reservations
            setView('summary') // Go to Summary View before Payment
        } catch (error: any) {
            console.error('Reservation Error:', error)
            toast.error(error.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    // Step 2 of Booking: Pay
    const handlePaystackPayment = async () => {
        const { total } = calculateFinancials()
        // Handle Free Tickets immediately
        if (total === 0) {
            setView('success')
            return
        }

        setLoading(true)
        try {
            // Use stored reservations
            const reservations = purchasedTickets
            if (reservations.length === 0) throw new Error('No active reservation')

            const primaryTier = tiers.find(t => t.id === reservations[0].ticket_tier_id)

            const response = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: guestEmail,
                    amount: Math.round(total * 100),
                    currency: primaryTier?.currency || 'GHS',
                    reservationIds: reservations.map(r => r.id),
                    callbackUrl: `${window.location.protocol}//${window.location.host}${window.location.pathname}?event_id=${event.id}`
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Payment initialization failed')
            window.location.href = data.authorization_url

        } catch (error: any) {
            console.error('Payment Error:', error)
            toast.error(error.message)
            setLoading(false)
        }
    }

    const formatDateRange = (start: string, end?: string) => {
        const startDate = new Date(start)
        const endDate = end ? new Date(end) : null

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
                // Calculate number of days
                const s = new Date(startDate)
                s.setHours(0, 0, 0, 0)
                const e = new Date(endDate)
                e.setHours(0, 0, 0, 0)
                const diffTime = Math.abs(e.getTime() - s.getTime())
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

                return `${dateString}, ${startTime} - ${endDateString}, ${endTime} (${days} Days)`
            }
        }
        return `${dateString} • ${startTime}`
    }

    // Render Methods
    const renderDetails = () => (
        <motion.div
            key="details"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col h-full bg-white p-6 relative overflow-y-auto no-scrollbar"
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 text-black flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 border border-gray-100 relative">
                        {event.logo_url ? (
                            <Image src={event.logo_url} alt="Logo" fill className="object-cover" />
                        ) : (
                            <span className="text-[10px]">{event.title?.substring(0, 2).toUpperCase() || 'GP'}</span>
                        )}
                    </div>
                    <div>
                        <h2 className="text-[17px] font-bold text-black leading-none tracking-tight mb-0.5">{event.title}</h2>
                        <button
                            onClick={() => setDetailsSlide(detailsSlide === 'host' ? 'description' : 'host')}
                            className="flex items-center gap-0.5 group outline-none text-left"
                        >
                            <p className="text-[12px] text-gray-500 font-medium group-hover:text-black transition-colors">
                                {event.organizers?.name || 'GatePass Event'}
                            </p>
                            <ChevronRight className={`w-3 h-3 text-gray-400 group-hover:text-black transition-transform duration-300 ${detailsSlide === 'host' ? 'rotate-90' : ''}`} />
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

            {/* Dynamic Content Area */}
            <div className="mt-4 flex-1 relative min-h-[120px]">
                <AnimatePresence mode="wait">
                    {detailsSlide === 'description' && (
                        <motion.div
                            key="description"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div
                                className="text-[13px] font-normal text-black leading-relaxed mb-4 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: event.description || '' }}
                            />

                            {/* Lineup Preview (Clickable) */}
                            {(event as any).lineup && (event as any).lineup.length > 0 && (
                                <button
                                    onClick={() => setDetailsSlide('lineup')}
                                    className="mt-5 mb-2 w-full text-left group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Lineup</span>
                                        <span className="text-[10px] font-medium text-gray-400 group-hover:text-black transition-colors">View All</span>
                                    </div>
                                    <div className="flex -space-x-2 overflow-hidden py-1">
                                        {(event as any).lineup.slice(0, 4).map((item: any, i: number) => (
                                            <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 overflow-hidden relative z-[1]">
                                                {item.image_url ? (
                                                    <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                        {item.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {(event as any).lineup.length > 4 && (
                                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-50 flex items-center justify-center relative z-0">
                                                <span className="text-[10px] font-bold text-gray-500">+{(event as any).lineup.length - 4}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            )}
                        </motion.div>
                    )}

                    {detailsSlide === 'host' && (
                        <motion.div
                            key="host"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            <div>
                                <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-2">About the Host</h3>
                                <p className="text-[13px] text-gray-600 leading-relaxed">
                                    {event.organizers?.description || 'No bio available.'}
                                </p>
                            </div>

                            {/* Organizer Socials */}
                            {event.organizers && (
                                <div className="flex items-center gap-3 pt-2">
                                    {event.organizers.website && (
                                        <a href={event.organizers.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                    {event.organizers.instagram && (
                                        <a href={`https://instagram.com/${event.organizers.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" display="none" /><rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2" /></svg>
                                        </a>
                                    )}
                                    {event.organizers.twitter && (
                                        <a href={`https://twitter.com/${event.organizers.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                        </a>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {detailsSlide === 'lineup' && (
                        <motion.div
                            key="lineup"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Full Lineup</h3>
                                <button
                                    onClick={() => setDetailsSlide('description')}
                                    className="text-[10px] font-bold text-gray-400 hover:text-black flex items-center gap-1"
                                >
                                    <ArrowLeft className="w-3 h-3" /> Back
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {((event as any).lineup || []).map((item: any, i: number) => (
                                    <div key={i} className="flex flex-col items-center text-center">
                                        <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden mb-2 relative">
                                            {item.image_url ? (
                                                <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                    {item.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[11px] font-bold leading-tight text-black w-full break-words">{item.name}</div>
                                        <div className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{item.role}</div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Logistics */}
            <div className="flex flex-col gap-3 mb-5 mt-auto bg-gray-50/50 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span className="text-[13px] font-medium text-black leading-tight">
                        {formatDateRange(event.starts_at, event.ends_at)}
                    </span>
                </div>
                <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-black leading-tight mb-0.5">{event.venue_name}</span>
                        <span className="text-[12px] text-gray-500 leading-tight">
                            {/* @ts-ignore */}
                            {event.venue_address || event.location || 'Location Details'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Footer Action */}
            <div>
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setView('tickets')}
                    style={{ backgroundColor: event.primary_color || '#000000', color: getContrastColor(event.primary_color || '#000000') }}
                    className="w-full h-10 rounded-lg text-[13px] font-bold tracking-wide transition-all shadow-lg text-white"
                >
                    Get Tickets
                </motion.button>
                <div className="flex justify-end mt-3">
                    <span className="text-[10px] text-gray-500 font-medium">Powered by GatePass</span>
                </div>
            </div>
        </motion.div>
    )

    const renderTickets = () => {
        const { total } = calculateFinancials()
        const hasSelection = total > 0

        return (
            <motion.div
                key="tickets"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col h-full bg-white relative"
            >
                <div className="flex justify-between items-center mb-6 px-6 pt-6 flex-shrink-0">
                    <h2 className="text-[18px] font-bold tracking-tight text-black">Select Tickets</h2>
                    <button
                        onClick={() => setView('details')}
                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black transition-all bg-gray-50 rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-4 no-scrollbar">
                    {tiers.map((tier, idx) => (
                        <TicketCard
                            key={tier.id}
                            tier={tier}
                            qty={selectedTickets[tier.id] || 0}
                            onQuantityChange={handleQuantityChange}
                            primaryColor={event.primary_color}
                        />
                    ))}
                </div>

                <div className={`
                    absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-10 transition-transform duration-300
                    ${hasSelection ? 'translate-y-0' : 'translate-y-full'}
                `}>
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => availableAddons.length > 0 ? setView('addons') : setView('checkout')}
                        style={{ backgroundColor: event.primary_color || '#000000', color: getContrastColor(event.primary_color || '#000000') }}
                        className="w-full h-10 rounded-lg text-[13px] font-bold tracking-wide transition-all shadow-lg flex items-center justify-between px-4"
                    >
                        <span>{availableAddons.length > 0 ? 'Continue to Add-ons' : 'Checkout'}</span>
                        <span>{formatCurrency(total, tiers[0]?.currency)}</span>
                    </motion.button>
                    <div className="flex justify-center mt-3">
                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Secure Payment by GatePass
                        </span>
                    </div>
                </div>
            </motion.div>
        )
    }

    const renderAddons = () => {
        const { total } = calculateFinancials()
        const hasSelection = Object.values(selectedAddons).some(qty => qty > 0)

        return (
            <motion.div
                key="addons"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col h-full bg-white relative"
            >
                <div className="flex justify-between items-center mb-6 px-6 pt-6 flex-shrink-0">
                    <div>
                        <h2 className="text-[18px] font-bold tracking-tight text-black">Enhance Experience</h2>
                        <p className="text-[13px] text-gray-400 font-medium tracking-tight">Select optional extras</p>
                    </div>
                    <button
                        onClick={() => setView('tickets')}
                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black transition-all bg-gray-50 rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-4 pt-2 no-scrollbar">
                    {availableAddons.map((addon, idx) => (
                        <AddonCard
                            key={addon.id}
                            addon={addon}
                            index={idx}
                            qty={selectedAddons[addon.id] || 0}
                            onQuantityChange={handleAddonQuantityChange}
                            primaryColor={event.primary_color}
                        />
                    ))}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-10">
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setView('checkout')}
                        style={{ backgroundColor: event.primary_color || '#000000', color: getContrastColor(event.primary_color || '#000000') }}
                        className="w-full h-10 rounded-lg text-[13px] font-bold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        <span>{hasSelection ? 'Continue with Add-ons' : 'No Thanks, Continue'}</span>
                        <ChevronRight className="w-4 h-4" />
                    </motion.button>
                </div>
            </motion.div>
        )
    }

    const renderCheckout = () => (
        <motion.div
            key="checkout"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col h-full bg-white relative"
        >
            <div className="flex justify-between items-center mb-8 px-6 pt-6 flex-shrink-0">
                <h2 className="text-[18px] font-bold tracking-tight text-black">Your Details</h2>
                <button
                    onClick={() => availableAddons.length > 0 ? setView('addons') : setView('tickets')}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black transition-all bg-gray-50 rounded-full"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-5 px-6 pb-24 overflow-y-auto no-scrollbar">
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                    <input
                        type="text"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-black text-[16px] placeholder:text-gray-400 font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                    <input
                        type="email"
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-black text-[16px] placeholder:text-gray-400 font-medium"
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
                        className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-black text-[16px] placeholder:text-gray-400 font-medium"
                    />
                </div>
            </div>

            <div className="mt-auto p-4 bg-white absolute bottom-0 left-0 right-0 border-t border-gray-100">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateReservation}
                    disabled={loading || !guestName || !guestEmail}
                    style={{
                        backgroundColor: (guestName && guestEmail) ? (event.primary_color || '#000000') : undefined,
                        color: (guestName && guestEmail) ? getContrastColor(event.primary_color || '#000000') : '#ffffff'
                    }}
                    className="w-full h-10 bg-black text-white rounded-lg text-[13px] font-bold tracking-wide disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2 group"
                >
                    {loading ? 'Processing...' : 'Continue to Payment'}
                    {!loading && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                </motion.button>
            </div>
        </motion.div>
    )

    const renderSummary = () => {
        const { subtotal, addonSubtotal, fees, total, discountAmount } = calculateFinancials()
        // Timer Logic for colors
        let timerColor = "bg-black/80 backdrop-blur-md text-white border-white/10"
        let dotColor = "bg-green-400 animate-pulse"
        if (timeLeft <= 150) {
            timerColor = "bg-red-500 text-white border-red-400"
            dotColor = "bg-white animate-pulse"
        } else if (timeLeft <= 300) {
            timerColor = "bg-yellow-400 text-black border-yellow-300"
            dotColor = "bg-black animate-pulse"
        }

        return (
            <motion.div
                key="summary"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col h-full bg-white relative"
            >
                {/* Immersive Timer */}
                <div className="flex justify-center mt-6 mb-2 sticky top-4 z-20 pointer-events-none">
                    <div className={`${timerColor} py-2 px-4 rounded-full text-[12px] font-medium shadow-xl flex items-center gap-2 border animate-fade-in-down transition-colors duration-500`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${formattedTime === 'EXPIRED' ? 'bg-red-500' : dotColor}`} />
                        <span>Reservation expires in <span className="font-mono tracking-wider font-bold">{formattedTime}</span></span>
                    </div>
                </div>

                <div className="flex justify-between items-center px-6 pt-2 mb-6 flex-shrink-0">
                    <h2 className="text-[18px] font-bold tracking-tight text-black">Order Summary</h2>
                    <button
                        onClick={() => setView('checkout')}
                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black transition-all bg-gray-50 rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar">
                    <div className="bg-white rounded-2xl p-0 border border-gray-100 overflow-hidden shadow-sm relative">
                        <div className="bg-gray-50 p-6 border-b border-gray-100">
                            <h3 className="text-[16px] font-bold leading-tight text-black">{event.title}</h3>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Tickets */}
                            <div className="space-y-3">
                                {Object.entries(selectedTickets).filter(([_, q]) => q > 0).map(([id, qty]) => {
                                    const tier = tiers.find(t => t.id === id)
                                    return (
                                        <div key={id} className="flex justify-between items-center text-[13px] text-gray-500">
                                            <span>{tier?.name} <span className="text-[11px] ml-1">x{qty}</span></span>
                                            <span className="font-medium text-black">{formatCurrency((tier?.price || 0) * qty, tier?.currency)}</span>
                                        </div>
                                    )
                                })}

                                {/* Add-ons */}
                                {Object.entries(selectedAddons).filter(([_, q]) => q > 0).map(([id, qty]) => {
                                    const addon = availableAddons.find(a => a.id === id)
                                    return (
                                        <div key={id} className="flex justify-between items-center text-[13px] text-gray-500">
                                            <span>{addon?.name} <span className="text-[11px] ml-1">x{qty}</span></span>
                                            <span className="font-medium text-black">{formatCurrency((addon?.price || 0) * qty, addon?.currency)}</span>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="h-px bg-gray-100 w-full" />

                            <div className="space-y-2 text-[13px]">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(subtotal + addonSubtotal, tiers[0]?.currency)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Fees</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(fees, tiers[0]?.currency)}</span>
                                </div>

                                {/* Discount Row */}
                                {discount && (
                                    <div className="flex justify-between items-center text-green-600 animate-fade-in">
                                        <span className="flex items-center gap-1.5">
                                            <Ticket className="w-3.5 h-3.5" />
                                            Promo ({discount.code})
                                        </span>
                                        <span className="font-bold">
                                            - {formatCurrency(discountAmount, tiers[0]?.currency)}
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
                                            className="text-[13px] text-gray-500 font-medium hover:text-black transition-colors flex items-center gap-2 group"
                                        >
                                            <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center group-hover:border-gray-400 transition-colors">
                                                <Plus className="w-3 h-3" />
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
                                                    className="flex-1 bg-white border border-gray-200 rounded-lg text-[13px] px-3 py-2 uppercase placeholder:normal-case focus:ring-1 focus:ring-black focus:border-black outline-none transition-all text-black"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            handleApplyDiscount()
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setShowPromo(false)
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={handleApplyDiscount}
                                                    disabled={!promoCode || applyingDiscount}
                                                    className="bg-black text-white px-4 py-2 rounded-lg text-[12px] font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                                                >
                                                    {applyingDiscount ? '...' : 'Apply'}
                                                </button>
                                                <button
                                                    onClick={() => setShowPromo(false)}
                                                    className="p-2 text-gray-400 hover:text-black transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {discountError && <p className="text-red-500 text-[11px] mt-1.5 font-medium ml-1 flex items-center gap-1"><X className="w-3 h-3" />{discountError}</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="border-t border-dashed border-gray-200 pt-2" />

                            <div className="flex justify-between items-end">
                                <span className="text-[15px] font-bold text-gray-900">Total Due</span>
                                <div className="text-right">
                                    <span className="text-[24px] font-bold text-black leading-none tracking-tight block">{formatCurrency(total, tiers[0]?.currency)}</span>
                                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Incl. taxes & fees</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-[10px] text-gray-400 mt-4 px-4 leading-relaxed mb-4">
                        By purchasing, you agree to the <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>. All sales are final.
                    </p>
                </div>

                <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 p-4 absolute bottom-0 left-0 right-0 z-30">
                    <button
                        onClick={handlePaystackPayment}
                        disabled={loading}
                        style={{ backgroundColor: event.primary_color || '#000000', color: getContrastColor(event.primary_color || '#000000') }}
                        className="w-full h-10 rounded-lg text-[13px] font-bold tracking-wide hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processing...' : `Pay ${formatCurrency(total, tiers[0]?.currency)}`}
                    </button>
                    <div className="flex justify-center mt-3">
                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Secure Payment by GatePass
                        </span>
                    </div>
                </div>
            </motion.div>
        )
    }

    const renderSuccess = () => {
        // Use the first reservation since typically it's one order flow
        const ticket = purchasedTickets[0]

        const handleDownloadPDF = async () => {
            // In a real embed, we might redirect to a full success page or trigger download API
            toast.success('Download starting...')
            if (ticket) {
                window.location.href = `/api/reservations/${ticket.reservation_id}/download`
            }
        }

        const handleCalendar = () => {
            const start = new Date(event.starts_at).toISOString().replace(/-|:|\.\d\d\d/g, "")
            const endDate = event.ends_at ? new Date(event.ends_at) : new Date(new Date(event.starts_at).getTime() + 7200000)
            const end = endDate.toISOString().replace(/-|:|\.\d\d\d/g, "")
            const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.venue_name || '')}`
            window.open(url, '_blank')
        }

        return (
            <motion.div
                key="success"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                className="flex flex-col h-full bg-white rounded-[24px] overflow-hidden relative"
            >
                <div className="flex-shrink-0 px-6 pt-6 pb-2 flex justify-between items-start">
                    <div className="space-y-1">
                        <h2 className="text-[18px] leading-tight font-extrabold tracking-tight text-black max-w-[200px]">
                            See you at {event.title}!🎉
                        </h2>
                    </div>
                    <button onClick={() => window.location.reload()} className="p-1.5 -mr-1.5 text-black hover:opacity-70">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 no-scrollbar">
                    <div className="flex flex-col items-center my-6">
                        <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm mb-3">
                            {ticket?.qr_code_hash ? (
                                <Image
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qr_code_hash}&color=000000`}
                                    alt="QR Code"
                                    width={128}
                                    height={128}
                                    className="w-32 h-32 object-contain mix-blend-multiply"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Check className="w-10 h-10 text-green-500" />
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 select-all">
                            {ticket?.qr_code_hash || 'ORDER CONFIRMED'}
                        </span>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-[20px] p-4 space-y-3">
                        <h3 className="text-[16px] font-bold text-black leading-tight mb-0.5">{event.title}</h3>

                        <div className="space-y-2.5">
                            {/* Simple counts for success screen */}
                            {Object.entries(selectedTickets).filter(([_, q]) => q > 0).map(([id, qty]) => {
                                const tier = tiers.find(t => t.id === id)
                                return (
                                    <div key={id} className="flex justify-between items-center text-[13px]">
                                        <span className="font-medium text-black">{tier?.name}</span>
                                        <span className="font-bold text-gray-500">x{qty}</span>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="h-px w-full bg-gray-200" />

                        <div className="space-y-3 text-[13px]">
                            <div className="flex justify-between items-start">
                                <span className="text-gray-500 font-medium">Location</span>
                                <span className="font-bold text-black text-right max-w-[60%] leading-tight">{event.venue_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Date</span>
                                <span className="font-bold text-black">
                                    {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-gray-100">
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleDownloadPDF}
                            className="w-full h-12 bg-black text-white rounded-[20px] text-[15px] font-bold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3"
                        >
                            <Download className="w-4 h-4" /> Download PDF Tickets
                        </button>

                        <div className="flex gap-3">
                            <a
                                href={window.location.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 h-12 bg-gray-100 text-black rounded-2xl text-[13px] font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                <Share2 className="w-4 h-4" /> Share
                            </a>
                            <button
                                onClick={handleCalendar}
                                className="flex-1 h-12 bg-zinc-50 text-black border border-gray-200 rounded-2xl text-[13px] font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                            >
                                <Calendar className="w-4 h-4" /> Calendar
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        )
    }

    if (verifying) {
        return (
            <div className="h-full min-h-[400px] bg-white flex flex-col items-center justify-center font-sans">
                <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin mb-4" />
                <h2 className="text-xl font-bold tracking-tight text-black">Verifying Payment</h2>
                <p className="text-sm text-gray-500 mt-2">Securing your ticket...</p>
            </div>
        )
    }

    return (
        <div className="w-full h-full min-h-screen bg-white md:rounded-2xl overflow-hidden shadow-2xl flex flex-col font-sans text-black border border-gray-100 selection:bg-black/10">
            <AnimatePresence mode="wait">
                {view === 'details' && renderDetails()}
                {view === 'tickets' && renderTickets()}
                {view === 'addons' && renderAddons()}
                {view === 'checkout' && renderCheckout()}
                {view === 'summary' && renderSummary()}
                {view === 'success' && renderSuccess()}
            </AnimatePresence>
            <Toaster position="bottom-center" richColors closeButton />
        </div>
    )
}
