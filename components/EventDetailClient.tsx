'use client'

import React, { useState, useEffect } from 'react'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
// Dynamic imports for heavy libraries
// import html2canvas from 'html2canvas'
// import jsPDF from 'jspdf'
// import confetti from 'canvas-confetti'
import { Event, TicketTier, Discount } from '@/types/gatepass'
import { createClient } from '@/utils/supabase/client'
import { createReservation } from '@/utils/gatepass'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Globe, Calendar, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { calculateFees } from '@/utils/fees'

interface EventDetailClientProps {
    event: Event
    tiers: TicketTier[]
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

export function EventDetailClient({ event, tiers }: EventDetailClientProps) {
    const [view, setView] = useState<'details' | 'tickets' | 'checkout' | 'summary' | 'success'>('details')
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({})
    const [reservation, setReservation] = useState<any>(null)
    const [purchasedTickets, setPurchasedTickets] = useState<any[]>([])

    // Navigation Helper
    const navigate = (newView: typeof view, dir: 'forward' | 'back' = 'forward') => {
        setDirection(dir)
        // Small timeout to allow render cycle to pick up direction? 
        // Actually, normally we want to set them together.
        // But React batches updates.
        // We will stick to simply setting state.
        setView(newView)
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
        if (reference) {
            const verifyPayment = async () => {
                setVerifying(true)
                try {
                    // Use reference as reservationId fallback since we link them
                    const response = await fetch('/api/paystack/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference, reservationId: reference })
                    })
                    const result = await response.json()

                    // Clear params to avoid re-verification loop (optional, but good UX)
                    window.history.replaceState({}, '', window.location.pathname)

                    if (!result.success) throw new Error(result.error || 'Verification failed')

                    setPurchasedTickets(result.tickets || [])
                    navigate('success', 'forward')
                    // addToast('Payment valid! Your ticket is ready.', 'success') // Confetti handles delight
                } catch (error: any) {
                    console.error('Verification Error:', error)
                    toast.error(error.message || 'Payment verification failed')
                } finally {
                    setVerifying(false)
                }
            }
            verifyPayment()
        }
    }, [searchParams])

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user && !user.is_anonymous) {
                // Pre-fill or skip form? Let's pre-fill for now so they can verify phone
                // Fetch profile
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
            return { ...prev, [tierId]: intent }
        })
    }

    const calculatedTotal = Object.entries(selectedTickets).reduce((acc, [tierId, qty]) => {
        const tier = tiers.find(t => t.id === tierId)
        return acc + (tier ? tier.price * qty : 0)
    }, 0)

    // Discount Calculation
    const discountAmount = discount
        ? (discount.type === 'fixed'
            ? discount.value
            : (calculatedTotal * (discount.value / 100)))
        : 0

    const discountedSubtotal = Math.max(0, calculatedTotal - discountAmount)
    const { clientFees, customerTotal } = calculateFees(discountedSubtotal, event.fee_bearer as 'customer' | 'organizer')
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

            setDiscount(data as Discount)
            toast.success('Discount applied!')
        } catch (e) {
            setDiscountError('Failed to verify code')
        } finally {
            setApplyingDiscount(false)
        }
    }

    const handleContinueToCheckout = () => {
        navigate('checkout', 'forward')
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
            const newReservation = await createReservation(event.id, selectedTier.id, userId, qty, supabase, {
                email: guestEmail,
                name: guestName,
                phone: guestPhone
            })
            if (!newReservation || !newReservation.id) throw new Error('Failed to create reservation')

            setReservation(newReservation)
            setReservation(newReservation)
            navigate('summary', 'forward')

        } catch (error: any) {
            if (error.message?.includes('already registered')) {
                toast.info('An account with this email already exists. Please log in.')
                router.push(`/login?redirect=/events/${event.id}`)
            } else {
                toast.error(error.message || 'An unexpected error occurred')
            }
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
                    callbackUrl: window.location.href // Return to this page
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
    const isExpanded = view !== 'details'

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

            {/* Expanded Modal Backdrop */}
            {isExpanded && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
                    onClick={() => view === 'success' ? window.location.reload() : navigate('details', 'back')}
                />
            )}

            {/* Floating Card / Modal Container */}
            <div className={`
                fixed z-50 bg-white text-black shadow-2xl transition-all duration-300 font-sans
                bottom-4 left-4 right-4 
                mb-[env(safe-area-inset-bottom)]
                rounded-2xl max-h-[85vh] flex flex-col
                md:translate-x-0 md:translate-y-0 md:top-auto md:left-auto md:w-[360px] md:mb-0
                md:bottom-12 md:right-12 p-4
                ${view === 'success' ? 'md:bottom-8 md:right-8 md:w-[380px]' : ''}
            `}>
                {view === 'details' && (
                    <div className={direction === 'back' ? 'animate-slide-in-left' : 'animate-slide-in-right'}>
                        <DetailsView
                            event={event}
                            cheapestTier={cheapestTier}
                            onGetTickets={() => navigate('tickets', 'forward')}
                        />
                    </div>
                )}
                {view === 'tickets' && (
                    <div className={direction === 'back' ? 'animate-slide-in-left' : 'animate-slide-in-right'}>
                        <TicketsView
                            tiers={tiers}
                            selectedTickets={selectedTickets}
                            onQuantityChange={handleQuantityChange}
                            onContinue={handleContinueToCheckout}
                            onBack={() => navigate('details', 'back')}
                            total={calculatedTotal}
                            hasSelection={hasSelection}
                        />
                    </div>
                )}
                {view === 'checkout' && (
                    <div className={direction === 'back' ? 'animate-slide-in-left' : 'animate-slide-in-right'}>
                        <CheckoutFormView
                            guestName={guestName} setGuestName={setGuestName}
                            guestEmail={guestEmail} setGuestEmail={setGuestEmail}
                            guestPhone={guestPhone} setGuestPhone={setGuestPhone}
                            onBack={() => navigate('tickets', 'back')}
                            onContinue={handleCreateReservation}
                            loading={loading}
                        />
                    </div>
                )}
                {view === 'summary' && (
                    <div className={direction === 'back' ? 'animate-slide-in-left' : 'animate-slide-in-right'}>
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
                        />
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
            </div>
        </>
    )
}

// Sub-components

const DetailsView = ({ event, cheapestTier, onGetTickets }: { event: Event, cheapestTier: TicketTier | null, onGetTickets: () => void }) => (
    <div className="animate-fade-in">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-black flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 border border-gray-100">
                    {event.organizers?.logo_url ? (
                        <img src={event.organizers.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-[10px]">{event.organizers?.name?.substring(0, 2).toUpperCase() || 'GP'}</span>
                    )}
                </div>
                <div>
                    <h2 className="text-[17px] font-bold text-black leading-none tracking-tight mb-0.5">{event.title}</h2>
                    <p className="text-[12px] text-gray-500 font-medium">{event.organizers?.name || 'GatePass Event'}</p>
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
        <p className="text-[13px] font-normal text-black leading-relaxed mb-4">{event.description}</p>

        {/* Organizer Bio Section */}
        {event.organizers?.description && (
            <>
                <div className="h-px w-full bg-gray-200 mb-4" />
                <div className="mb-4">
                    <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest mb-2">About the Host</h3>
                    <p className="text-[12px] text-gray-600 leading-relaxed mb-3">
                        {event.organizers.description}
                    </p>

                    {/* Organizer Socials */}
                    <div className="flex items-center gap-3">
                        {event.organizers.website && (
                            <a href={event.organizers.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                <Globe className="w-3.5 h-3.5" />
                            </a>
                        )}
                        {event.organizers.instagram && (
                            <a href={`https://instagram.com/${event.organizers.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" display="none" /><rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2" /></svg>
                            </a>
                        )}
                        {event.organizers.twitter && (
                            <a href={`https://twitter.com/${event.organizers.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            </a>
                        )}
                    </div>
                </div>
            </>
        )}

        <div className="h-px w-full bg-gray-200 mb-4" />
        <div className="flex flex-col gap-3 mb-5">
            <div className="flex items-start gap-3">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 2V6" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 2V6" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 10H21" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="text-[13px] font-medium text-black leading-tight">
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
            <div className="flex items-start gap-3">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-black leading-tight mb-0.5">{event.venue_name}</span>
                    <span className="text-[12px] text-gray-500 leading-tight">{event.venue_address}</span>
                </div>
            </div>
        </div>
        <button onClick={onGetTickets} className="w-full bg-black text-white h-10 rounded-lg text-[13px] font-bold tracking-wide hover:bg-gray-900 transition-all active:scale-[0.98]">
            Get Tickets
        </button>
        <div className="flex justify-end mt-3">
            <span className="text-[10px] text-gray-500 font-medium">Powered by GatePass</span>
        </div>
    </div >
)

const TicketsView = ({ tiers, selectedTickets, onQuantityChange, onContinue, onBack, total, hasSelection }: {
    tiers: TicketTier[],
    selectedTickets: Record<string, number>,
    onQuantityChange: (tierId: string, delta: number) => void,
    onContinue: () => void,
    onBack: () => void,
    total: number,
    hasSelection: boolean
}) => (
    <div className="flex flex-col h-auto animate-fade-in relative">
        <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-[18px] font-bold tracking-tight">Select Tickets</h2>
            <button onClick={onBack} className="p-2 -mr-2 text-gray-400 hover:text-black transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <div className="-mx-4 px-5 overflow-x-auto flex gap-4 items-stretch pb-8 no-scrollbar snap-x snap-mandatory">
            {tiers.map((tier: TicketTier) => {
                const isSoldOut = tier.quantity_sold >= tier.total_quantity
                const remaining = tier.total_quantity - tier.quantity_sold
                const isLowStock = remaining > 0 && remaining <= 10
                const qty = selectedTickets[tier.id] || 0
                const isSelected = qty > 0
                return (
                    <div
                        key={tier.id}
                        className={`
                            relative flex-shrink-0 w-[85%] md:w-[280px] rounded-2xl p-5 flex flex-col justify-between 
                            transition-all duration-300 snap-center min-h-[320px]
                            ${isSelected
                                ? 'bg-black text-white scale-[1.02] ring-0'
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
                                <div className={`text-[15px] font-bold leading-tight ${isSelected ? 'text-gray-200' : 'text-gray-900'}`}>{tier.name}</div>
                            </div>

                            {tier.description && (
                                <p className={`text-[13px] leading-relaxed ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {tier.description}
                                </p>
                            )}

                            <div className={`h-px w-full ${isSelected ? 'bg-white/10' : 'bg-gray-100'}`} />

                            <div>
                                <h4 className={`text-[12px] font-bold mb-3 uppercase tracking-wider ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>Includes</h4>
                                <ul className={`text-[13px] space-y-2.5 leading-tight ${isSelected ? 'text-gray-300' : 'text-gray-600'}`}>
                                    <li className="flex gap-2.5">
                                        <span className={`block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isSelected ? 'bg-white' : 'bg-black'}`} />
                                        Full access to all sessions
                                    </li>
                                    <li className="flex gap-2.5">
                                        <span className={`block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isSelected ? 'bg-white' : 'bg-black'}`} />
                                        Entry to exhibition floor
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className={`mt-6 flex items-center justify-between px-1 py-1 rounded-full ${isSelected ? 'bg-white/10' : 'bg-gray-50'}`}>
                            <button
                                onClick={() => onQuantityChange(tier.id, -1)}
                                disabled={qty === 0}
                                className={`w-10 h-10 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-white text-black'}`}
                            >
                                -
                            </button>
                            <span className={`font-bold text-lg min-w-[20px] text-center ${isSelected ? 'text-white' : 'text-black'}`}>{qty}</span>
                            <button
                                onClick={() => onQuantityChange(tier.id, 1)}
                                disabled={isSoldOut}
                                className={`w-10 h-10 flex items-center justify-center text-lg leading-none rounded-full transition-colors ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-white text-black'}`}
                            >
                                +
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>

        {/* Sticky Footer with Total */}
        <div className={`
                sticky bottom-0 -mx-4 -mb-4 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-10
                md:static md:bg-transparent md:border-0 md:backdrop-filter-none md:p-0 md:mt-8 md:mx-0 md:mb-0
                transition-transform duration-300
                ${hasSelection ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
            <div className="max-w-md mx-auto md:max-w-none">
                <button
                    onClick={onContinue}
                    disabled={!hasSelection}
                    className="w-full bg-black text-white h-10 rounded-lg text-[13px] font-bold tracking-wide hover:bg-gray-900 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-between px-4"
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

const CheckoutFormView = ({ guestName, setGuestName, guestEmail, setGuestEmail, guestPhone, setGuestPhone, onBack, onContinue, loading }: {
    guestName: string, setGuestName: (name: string) => void,
    guestEmail: string, setGuestEmail: (email: string) => void,
    guestPhone: string, setGuestPhone: (phone: string) => void,
    onBack: () => void,
    onContinue: () => void,
    loading: boolean
}) => (
    <div className="flex flex-col h-auto animate-fade-in relative">
        <div className="flex justify-between items-center mb-8 px-1">
            <h2 className="text-[18px] font-bold tracking-tight">Your Details</h2>
            <button onClick={onBack} className="p-2 -mr-2 text-gray-400 hover:text-black transition-colors">
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
                    className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-black text-[13px] placeholder:text-gray-400 font-medium"
                />
            </div>

            <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-black text-[13px] placeholder:text-gray-400 font-medium"
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
                    className="w-full h-10 px-3 rounded-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-black text-[13px] placeholder:text-gray-400 font-medium"
                />
            </div>
        </div>

        {/* Sticky Footer for Form */}
        <div className="sticky bottom-0 -mx-4 -mb-4 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-10 md:static md:bg-transparent md:border-0 md:backdrop-filter-none md:p-0 md:mt-8 md:mx-0 md:mb-0">
            <div className="max-w-md mx-auto md:max-w-none">
                <button
                    onClick={onContinue}
                    disabled={loading || !guestName || !guestEmail}
                    className="w-full bg-black text-white h-10 rounded-lg text-[13px] font-bold tracking-wide hover:bg-gray-900 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? 'Processing...' : 'Continue to Payment'}
                    {!loading && <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
                </button>
            </div>
        </div>
    </div>
)

const SummaryView = ({ event, tiers, subtotal, fees, total, timeLeft, loading, onBack, onPay, promoCode, setPromoCode, onApplyDiscount, discount, discountError, applyingDiscount, selectedTickets }: {
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
    timeLeft: { label: string, seconds: number }
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
        <div className="flex flex-col h-auto animate-fade-in relative">
            {/* Immersive Timer */}
            <div className="flex justify-center mb-4 sticky top-4 z-20 pointer-events-none">
                <div className={`${timerColor} py-2 px-4 rounded-full text-[12px] font-medium shadow-xl flex items-center gap-2 border animate-fade-in-down transition-colors duration-500`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${timeLeft.label === 'EXPIRED' ? 'bg-red-500' : dotColor}`} />
                    <span>Reservation expires in <span className="font-mono tracking-wider font-bold">{timeLeft.label}</span></span>
                </div>
            </div>

            <div className="px-1 mt-0 mb-2">
                <button onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-black transition-colors -ml-1 py-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    <span className="text-[13px] font-bold">Back</span>
                </button>
                <h2 className="text-[18px] font-bold tracking-tight mt-1">Order Summary</h2>
            </div>

            {/* Receipt Card */}
            <div className="bg-white rounded-2xl p-0 border border-gray-100 overflow-hidden shadow-sm relative mx-1">
                {/* Visual Header */}
                <div className="bg-gray-50 p-6 border-b border-gray-100">
                    <h3 className="text-[16px] font-bold leading-tight">{event.title}</h3>
                </div>

                <div className="p-6 space-y-4">
                    {/* Ticket Breakdown */}
                    <div className="space-y-3">
                        {tiers.map(tier => {
                            const qty = selectedTickets[tier.id] || 0
                            if (qty === 0) return null
                            return <SummaryTicketItem key={tier.id} tier={tier} qty={qty} />
                        })}
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Fees & Subtotal */}
                    <div className="space-y-2 text-[13px]">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-medium text-gray-900">{formatCurrency(subtotal, tiers[0]?.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Fees</span>
                            <span className="font-medium text-gray-900">{formatCurrency(fees, tiers[0]?.currency)}</span>
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
                        <div className="bg-gray-50 rounded-lg p-3">
                            {!showPromo ? (
                                <button
                                    onClick={() => setShowPromo(true)}
                                    className="text-[12px] text-gray-500 font-bold hover:text-black transition-colors flex items-center gap-1 w-full"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    ADD PROMO CODE
                                </button>
                            ) : (
                                <div className="animate-fade-in">
                                    <div className="flex gap-2">
                                        <input
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value)}
                                            placeholder="CODE"
                                            className="flex-1 bg-white border border-gray-200 rounded-md text-[13px] px-3 py-1.5 uppercase placeholder:normal-case focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                                            autoFocus
                                        />
                                        <button
                                            onClick={onApplyDiscount}
                                            disabled={!promoCode || applyingDiscount}
                                            className="bg-black text-white px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-gray-800 disabled:opacity-50 transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                    {discountError && <p className="text-red-500 text-[11px] mt-1.5 font-medium ml-1">{discountError}</p>}
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

            {/* Terms */}
            <p className="text-center text-[10px] text-gray-400 mt-4 px-8 leading-relaxed">
                By purchasing, you agree to the <a href="#" className="underline hover:text-gray-500">Terms of Service</a> and <a href="#" className="underline hover:text-gray-500">Privacy Policy</a>.
                All sales are final.
            </p>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 -mx-4 -mb-4 p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-10 md:static md:bg-transparent md:border-0 md:backdrop-filter-none md:p-0 md:mt-8 md:mx-0 md:mb-0">
                <div className="max-w-md mx-auto md:max-w-none">
                    <button
                        onClick={onPay}
                        disabled={loading || timeLeft.label === 'EXPIRED'}
                        className="w-full bg-black text-white h-12 rounded-xl text-[14px] font-bold tracking-wide hover:bg-gray-900 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-black/10 flex items-center justify-center gap-2"
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
    const [activeTabIndex, setActiveTabIndex] = useState(0)
    const activeTicket = tickets[activeTabIndex]

    const handleDownloadPDF = async () => {
        setDownloading(true)
        try {
            // Target the hidden container with all tickets
            const element = document.getElementById('ticket-print-container')
            if (!element) return

            // Dynamically load heavy libraries
            const html2canvas = (await import('html2canvas')).default
            const jsPDF = (await import('jspdf')).default

            // Capture at 2x scale (3x is too heavy for large lists)
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
            })

            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a5') // A5 is good for mobile tickets
            const pdfPageWidth = pdf.internal.pageSize.getWidth()
            const pdfPageHeight = pdf.internal.pageSize.getHeight()
            const margin = 10 // 10mm margin

            const availableWidth = pdfPageWidth - (margin * 2)
            const availableHeight = pdfPageHeight - (margin * 2)

            const imgRatio = canvas.width / canvas.height

            // Calculate dimensions to FIT within the available area (contain)
            let finalPdfWidth = availableWidth
            let finalPdfHeight = finalPdfWidth / imgRatio

            if (finalPdfHeight > availableHeight) {
                finalPdfHeight = availableHeight
                finalPdfWidth = finalPdfHeight * imgRatio
            }

            // Center the image
            const x = margin + (availableWidth - finalPdfWidth) / 2
            const y = margin

            pdf.addImage(imgData, 'PNG', x, y, finalPdfWidth, finalPdfHeight)
            pdf.save(`${event.title.replace(/[^a-z0-9]/gi, '_')}_Tickets.pdf`)
        } catch (err) {
            console.error('PDF Generation Error:', err)
            toast.error('Failed to generate PDF')
        } finally {
            setDownloading(false)
        }
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

    const handleAddToCalendar = (type: 'google' | 'ics') => {
        const start = new Date(event.starts_at)
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000) // Assume 2 hours if not set

        if (type === 'google') {
            const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start.toISOString().replace(/-|:|\.\d\d\d/g, '')}/${end.toISOString().replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent('Ticket Ref: ' + activeTicket.id)}&location=${encodeURIComponent(event.venue_name)}&sf=true&output=xml`
            window.open(url, '_blank')
        } else {
            const icsContent = `BEGIN:VCALENDAR
            VERSION:2.0
            BEGIN:VEVENT
            URL:${window.location.href}
            DTSTART:${start.toISOString().replace(/-|:|\.\d\d\d/g, '')}
            DTEND:${end.toISOString().replace(/-|:|\.\d\d\d/g, '')}
            SUMMARY:${event.title}
            DESCRIPTION:Ticket Ref: ${activeTicket.id}
            LOCATION:${event.venue_name}
            END:VEVENT
            END:VCALENDAR`
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
            const link = document.createElement('a')
            link.href = window.URL.createObjectURL(blob)
            link.setAttribute('download', `${event.title}.ics`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

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

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in relative">
            <div className="flex-shrink-0 flex justify-between items-center mb-4">
                <h2 className="text-[17px] font-bold tracking-tight">Your Tickets ({tickets.length})</h2>
                <button onClick={() => window.location.reload()} className="p-2 -mr-2 text-gray-500 hover:text-black">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            {/* Tabs for Multiple Tickets */}
            {tickets.length > 1 && (
                <div className="flex-shrink-0 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
                    <div className="flex gap-2">
                        {tickets.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveTabIndex(index)}
                                className={`
                                    flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all
                                    ${activeTabIndex === index
                                        ? 'bg-black text-white shadow-md transform scale-105'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }
                                `}
                            >
                                Ticket {index + 1}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Ticket Display */}
            <div className="flex-1 overflow-y-auto min-h-0 md:max-h-none -mx-4 px-4 pb-4 no-scrollbar">
                <div key={activeTicket.id} className="flex justify-center animate-fade-in">
                    <ReceiptTicket
                        id={`ticket-card-${activeTabIndex}`}
                        event={event}
                        ticket={activeTicket}
                        tierName={tierName}
                    />
                </div>
            </div>

            {/* Bottom Actions - Compact */}
            <div className="flex-shrink-0 pt-4 bg-white border-t border-gray-100 mt-2 space-y-3">
                {/* Primary Action - Apple Wallet (Current Ticket) */}
                <button
                    onClick={() => window.open(`/api/wallet/apple?ticketId=${activeTicket.id}`, '_blank')}
                    className="w-full bg-black text-white h-12 rounded-xl text-[15px] font-bold tracking-wide hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12.02 0C19.2 0 24 4.54 24 11.2V24H0V11.2C0 4.54 4.8 0 11.98 0H12.02ZM6.34 21.06C6.34 21.6 6.76 22.02 7.3 22.02H16.7C17.24 22.02 17.66 21.6 17.66 21.06V11.4C17.66 8.3 15.34 6 12.02 6C8.7 6 6.34 8.3 6.34 11.4V21.06ZM12 7.82C13.68 7.82 15.06 9.2 15.06 10.88V13.5H16.5V11.4C16.5 8.92 14.48 6.9 12 6.9C9.52 6.9 7.5 8.92 7.5 11.4V13.5H8.94V10.88C8.94 9.2 10.32 7.82 12 7.82Z" />
                    </svg>
                    Add to Apple Wallet
                </button>

                {/* Secondary Actions Grid */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={handleShare}
                        className="h-10 bg-gray-50 hover:bg-gray-100 border border-transparent rounded-lg text-[12px] font-medium text-gray-700 transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        Share
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={downloading}
                        className="h-10 bg-gray-50 hover:bg-gray-100 border border-transparent rounded-lg text-[12px] font-medium text-gray-700 transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        {downloading ? (
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4 4m4 4V4"></path></svg>
                                Save PDF
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleAddToCalendar('google')}
                        className="h-10 bg-gray-50 hover:bg-gray-100 border border-transparent rounded-lg text-[12px] font-medium text-gray-700 transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        <Calendar className="w-4 h-4" />
                        Calendar
                    </button>
                </div>

                <div className="flex justify-center mt-2">
                    <div className="flex items-center gap-1.5 opacity-50">
                        <span className="text-[10px] text-gray-500 font-medium">Powered by GatePass</span>
                    </div>
                </div>
            </div>

            {/* Hidden Ticket for PDF Generation (Target) */}
            <div className="absolute top-0 left-[-9999px]" id="ticket-print-container">
                <div className="space-y-4 p-0 bg-white">
                    {tickets.map((ticket, index) => (
                        <div key={ticket.id} className="break-inside-avoid">
                            <ReceiptTicket
                                id={`ticket-card-hidden-${index}`}
                                event={event}
                                ticket={ticket}
                                tierName={tierName}
                                forceExpanded={true}
                                isPrint={true}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// Receipt Style Ticket Component
const ReceiptTicket = ({ id, event, ticket, tierName, forceExpanded = false, isPrint = false }: { id?: string, event: Event, ticket: any, tierName?: string, forceExpanded?: boolean, isPrint?: boolean }) => {
    const [isOpen, setIsOpen] = useState(true) // Expanded by default
    const showContent = isOpen || forceExpanded

    const handleWhatsAppShare = (e: React.MouseEvent) => {
        e.stopPropagation()
        const url = `${window.location.origin}/tickets/${ticket.id}`
        const text = `Here is your ticket for ${event.title}! 🎟️`
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')
    }

    return (
        <div
            id={id}
            onClick={() => setIsOpen(!isOpen)}
            className={`w-[300px] bg-[#ffffff] relative cursor-pointer transition-all duration-300 ease-in-out overflow-hidden ${isPrint ? 'rounded-xl border-[2px] border-[#111827]' : 'rounded-[20px]'}`}
            style={{
                boxShadow: isPrint ? 'none' : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
        >
            {/* Header Image (Web Only) */}
            {!isPrint && (
                <div className="w-full relative bg-[#f3f4f6] h-32">
                    {event.poster_url ? (
                        <img src={event.poster_url} className="w-full h-full object-cover" alt="Event Poster" />
                    ) : (
                        <div className="w-full h-full bg-[#111827] flex items-center justify-center">
                            <span className="text-[#ffffff] font-bold tracking-widest uppercase opacity-20">GatePass</span>
                        </div>
                    )}
                    {/* Gradient Overlay using explicit RGBA for PDF safety */}
                    <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}
                    />

                    {/* Floating Success Icon */}
                    <div className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 w-10 h-10 bg-[#000000] rounded-full flex items-center justify-center text-[#ffffff] shadow-lg border-2 border-[#ffffff] z-10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                </div>
            )}

            {/* Main Content Container */}
            <div className={`relative ${isPrint ? 'p-2' : 'pt-8 p-6'}`}>
                {/* Print Header (Minimal Left Aligned) */}
                {isPrint && (
                    <div className="flex flex-col items-start text-left mb-2 mx-1 mt-1">
                        <p className="text-[9px] text-[#6b7280] font-bold uppercase tracking-[0.2em] mb-2">Admit One</p>
                        <h3 className="text-[18px] font-black text-[#111827] uppercase leading-none tracking-tight">{event.title}</h3>
                    </div>
                )}

                {/* Web Header (Title) */}
                {!isPrint && (
                    <div className="text-center mb-4 mt-2">
                        <h3 className="text-[16px] font-bold text-[#111827] leading-tight mb-0.5">{event.title}</h3>
                        <p className="text-[11px] text-[#6b7280] font-medium tracking-wide uppercase">Official Ticket</p>
                    </div>
                )}

                {/* Dashed Line + Notches */}
                {!isPrint ? (
                    <div className="relative w-[calc(100%+3rem)] -mx-6 h-6 flex items-center justify-center my-2">
                        <div className="w-full border-t-[2px] border-dashed border-[#e5e7eb] mx-6" />
                        <div className="absolute left-[-12px] w-6 h-6 bg-[#f4f4f5] rounded-full shadow-[inset_-2px_0_2px_rgba(0,0,0,0.05)]" />
                        <div className="absolute right-[-12px] w-6 h-6 bg-[#f4f4f5] rounded-full shadow-[inset_2px_0_2px_rgba(0,0,0,0.05)]" />
                        {/* Note: bg color of notches matches global background (zinc-100/f4f4f5) to look transparent */}
                    </div>
                ) : (
                    <div className="w-full border-t-[2px] border-dashed border-[#111827] my-4 opacity-20" />
                )}

                {/* Collapsible Section */}
                <div className={isPrint ? '' : `overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ticket-content-collapsible ${showContent ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className={`pt-2 pb-4 ticket-content ${!isPrint ? 'max-h-[320px] overflow-y-auto custom-scrollbar pr-1' : ''}`}>
                        {/* Attendee Info - Cleaner for Print */}
                        <div className={`rounded-xl ${isPrint ? 'p-2 mb-3 border-none bg-transparent' : 'p-4 mb-6 bg-[#f9fafb] border border-[#f3f4f6]'}`}>
                            <p className="text-[10px] uppercase tracking-widest text-[#9ca3af] font-bold mb-2">Admit One</p>
                            <p className="text-[18px] font-bold text-[#111827] leading-none mb-1">
                                {ticket.reservations?.guest_name || ticket.reservations?.profiles?.full_name || 'Guest User'}
                            </p>
                            <p className="text-[12px] text-[#6b7280] font-medium">{tierName}</p>
                        </div>

                        <div className={`grid grid-cols-2 gap-4 ${isPrint ? 'mb-3' : 'mb-6'}`}>
                            <div>
                                <p className="text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold mb-1">Date</p>
                                <p className="text-[13px] font-bold text-[#111827]">
                                    {new Date(event.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold mb-1">Time</p>
                                <p className="text-[13px] font-bold text-[#111827]">
                                    {new Date(event.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                                </p>
                            </div>
                        </div>

                        <div className={`${isPrint ? 'mb-3' : 'mb-6'}`}>
                            <p className="text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold mb-1">Venue</p>
                            <div className="text-[#111827]">
                                <p className={`text-[13px] font-bold ${isPrint ? 'leading-tight' : 'truncate'}`}>
                                    {event.venue_name}
                                </p>
                                <p className={`text-[11px] text-[#6b7280] ${isPrint ? 'leading-tight mt-0.5' : 'truncate'}`}>{event.venue_address}</p>
                            </div>
                        </div>

                        {/* QR Code Area */}
                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                            <div className={`bg-white border-2 border-[#111827] rounded-xl shadow-sm ${isPrint ? 'p-2' : 'p-3'}`}>
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qr_code_hash}&color=000000`}
                                    alt="QR Code"
                                    className={`${isPrint ? 'w-24 h-24' : 'w-32 h-32'} object-contain mix-blend-multiply`}
                                />
                            </div>
                            <p className="text-center text-[10px] font-mono text-[#9ca3af] mt-3 tracking-widest uppercase">Scan at entry</p>
                        </div>
                        <p className="text-center text-[9px] font-mono text-[#d1d5db] tracking-[0.2em] mt-1">{ticket.qr_code_hash?.substring(0, 12)}</p>

                        {!forceExpanded && (
                            <button
                                onClick={handleWhatsAppShare}
                                className="w-full mt-6 h-10 bg-[#25D366] hover:bg-[#1db954] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                Send to Friend
                            </button>
                        )}

                        {/* Watermark for Print */}
                        {isPrint && (
                            <div className="flex justify-center mt-3 opacity-60">
                                <p className="text-[8px] text-[#9ca3af] font-medium tracking-widest uppercase">
                                    Powered by <span className="font-bold text-[#6b7280]">GatePass</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapsed Hint */}
                {!showContent && (
                    <div className="text-center pt-2 pb-1 animate-pulse collapsed-hint">
                        <div className="w-8 h-1 bg-[#e5e7eb] rounded-full mx-auto" />
                    </div>
                )}
            </div>

            {/* Scalloped Bottom */}
            <div
                className="h-4 w-full bg-[#ffffff] relative"
                style={{
                    background: 'radial-gradient(circle, transparent 50%, #ffffff 50%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 100%',
                    transform: 'rotate(180deg)'
                }}
            />
        </div>
    )
}

const EventCardSkeleton = () => (
    <div className={`
        fixed z-50 bg-white shadow-2xl font-sans
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
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                </div>
            </div>
            <div className="h-5 w-16 bg-gray-200 rounded" />
        </div>

        {/* Description Lines */}
        <div className="space-y-2 mb-6">
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-3 w-[90%] bg-gray-200 rounded" />
            <div className="h-3 w-[80%] bg-gray-200 rounded" />
        </div>

        {/* Date/Loc Skeleton */}
        <div className="flex justify-between mb-6">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>

        {/* Button Skeleton */}
        {/* Button Skeleton */}
        <div className="h-10 w-full bg-gray-200 rounded-lg" />
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
                        className={`text-left font-bold text-gray-900 leading-tight flex items-center gap-1.5 ${hasDescription ? 'hover:text-gray-700 cursor-pointer' : ''}`}
                        disabled={!hasDescription}
                    >
                        {tier.name}
                        <span className="text-gray-400 font-normal whitespace-nowrap">x{qty}</span>
                        {hasDescription && (
                            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                    </button>
                </div>
                <div className="font-bold flex-shrink-0 whitespace-nowrap">
                    {formatCurrency(tier.price * qty, tier.currency)}
                </div>
            </div>

            {hasDescription && isExpanded && (
                <div className="text-[11px] text-gray-400 leading-snug mt-1.5 animate-fade-in pl-1">
                    {tier.description}
                </div>
            )}
        </div>
    )
}
