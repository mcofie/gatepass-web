'use client'

import React, { useState, useEffect } from 'react'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import confetti from 'canvas-confetti'
import { Event, TicketTier, Discount } from '@/types/gatepass'
import { createClient } from '@/utils/supabase/client'
import { createReservation } from '@/utils/gatepass'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Globe } from 'lucide-react'

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
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({})
    const [reservation, setReservation] = useState<any>(null)
    const [purchasedTicket, setPurchasedTicket] = useState<any>(null)

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

                    setPurchasedTicket(result.ticket)
                    setView('success')
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
    const platformFees = discountedSubtotal * 0.05
    const totalDue = discountedSubtotal + platformFees

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
        setView('checkout')
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
            setView('summary')

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

    if (loading) {
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
                    onClick={() => view === 'success' ? window.location.reload() : setView('details')}
                />
            )}

            {/* Floating Card / Modal Container */}
            {/* Floating Card / Modal Container */}
            <div className={`
                fixed z-50 bg-white text-black shadow-2xl transition-all duration-300 font-sans
                bottom-4 left-4 right-4 
                mb-[env(safe-area-inset-bottom)]
                rounded-2xl
                md:translate-x-0 md:translate-y-0 md:top-auto md:left-auto md:w-[360px] md:mb-0
                md:bottom-12 md:right-12 p-4
                ${view === 'success' ? 'md:bottom-8 md:right-8 md:w-[380px]' : ''}
            `}>
                {view === 'details' && (
                    <DetailsView
                        event={event}
                        cheapestTier={cheapestTier}
                        onGetTickets={() => setView('tickets')}
                    />
                )}
                {view === 'tickets' && (
                    <TicketsView
                        tiers={tiers}
                        selectedTickets={selectedTickets}
                        onQuantityChange={handleQuantityChange}
                        onContinue={handleContinueToCheckout}
                        onBack={() => setView('details')}
                        total={calculatedTotal}
                        hasSelection={hasSelection}
                    />
                )}
                {view === 'checkout' && (
                    <CheckoutFormView
                        guestName={guestName} setGuestName={setGuestName}
                        guestEmail={guestEmail} setGuestEmail={setGuestEmail}
                        guestPhone={guestPhone} setGuestPhone={setGuestPhone}
                        onBack={() => setView('tickets')}
                        onContinue={handleCreateReservation}
                        loading={loading}
                    />
                )}
                {view === 'summary' && (
                    <SummaryView
                        event={event}
                        tiers={tiers}
                        selectedTickets={selectedTickets}
                        subtotal={calculatedTotal}
                        fees={platformFees}
                        total={totalDue}
                        timeLeft={timeLeft}
                        loading={loading}
                        onBack={() => setView('checkout')}
                        onPay={handlePaystackPayment}
                        promoCode={promoCode}
                        setPromoCode={setPromoCode}
                        onApplyDiscount={applyPromoCode}
                        discount={discount}
                        discountError={discountError}
                        applyingDiscount={applyingDiscount}
                    />
                )}
                {view === 'success' && purchasedTicket && (
                    <SuccessView
                        event={event}
                        ticket={purchasedTicket}
                        tierName={tiers.find(t => t.id === purchasedTicket.tier_id)?.name}
                    />
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
                        {cheapestTier.currency} {cheapestTier.price}
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
        <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 2V6" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 2V6" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 10H21" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="text-[12px] font-bold text-black">
                    {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="text-[12px] font-bold text-black truncate max-w-[160px]">{event.venue_name}</span>
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
                        <div className="space-y-4">
                            <div>
                                <div className={`text-[24px] font-bold leading-none mb-2 tracking-tighter ${isSelected ? 'text-white' : 'text-black'}`}>
                                    {tier.currency} {tier.price}
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
                    <span>{tiers[0]?.currency} {total.toFixed(2)}</span>
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
                            return (
                                <div key={tier.id} className="flex justify-between items-start text-[14px]">
                                    <div>
                                        <div className="font-bold text-gray-900">{tier.name} <span className="text-gray-400 font-normal">x{qty}</span></div>
                                        {tier.description && <div className="text-[11px] text-gray-400 leading-snug max-w-[200px] mt-0.5 line-clamp-1">{tier.description}</div>}
                                    </div>
                                    <div className="font-bold">{tier.currency} {(tier.price * qty).toFixed(2)}</div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Fees & Subtotal */}
                    <div className="space-y-2 text-[13px]">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-medium text-gray-900">{tiers[0]?.currency} {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500">Platform Fees</span>
                            <span className="font-medium text-gray-900">{tiers[0]?.currency} {fees.toFixed(2)}</span>
                        </div>

                        {/* Discount Row */}
                        {discount && (
                            <div className="flex justify-between items-center text-green-600 animate-fade-in">
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                                    Promo ({discount.code})
                                </span>
                                <span className="font-bold">
                                    - {tiers[0]?.currency} {discount.type === 'fixed' ? discount.value.toFixed(2) : ((subtotal * discount.value / 100).toFixed(2))}
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
                            <span className="text-[24px] font-bold text-black leading-none tracking-tight block">{tiers[0]?.currency} {total.toFixed(2)}</span>
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
                            <>Pay {tiers[0]?.currency} {total.toFixed(2)}</>
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

const SuccessView = ({ event, ticket, tierName }: { event: Event, ticket: any, tierName: string | undefined }) => {
    const [downloading, setDownloading] = useState(false)

    const handleDownloadPDF = async () => {
        setDownloading(true)
        try {
            // Target the hidden, fully expanded version
            const element = document.getElementById('ticket-card-hidden-print')
            if (!element) return

            // Capture at 3x scale for print quality
            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,
            })

            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a5')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`${event.title.replace(/[^a-z0-9]/gi, '_')}_Ticket.pdf`)
        } catch (err) {
            console.error('PDF Generation Error:', err)
            alert('Failed to generate PDF')
        } finally {
            setDownloading(false)
        }
    }

    // Confetti Effect
    useEffect(() => {
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
    }, [])

    const handleAddToCalendar = (type: 'google' | 'ics') => {
        const start = new Date(event.starts_at)
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000) // Assume 2 hours if not set

        if (type === 'google') {
            const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start.toISOString().replace(/-|:|\.\d\d\d/g, '')}/${end.toISOString().replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent('Ticket: ' + tierName)}&location=${encodeURIComponent(event.venue_name)}&sf=true&output=xml`
            window.open(url, '_blank')
        } else {
            const icsContent = `BEGIN:VCALENDAR
            VERSION:2.0
            BEGIN:VEVENT
            URL:${window.location.href}
            DTSTART:${start.toISOString().replace(/-|:|\.\d\d\d/g, '')}
            DTEND:${end.toISOString().replace(/-|:|\.\d\d\d/g, '')}
            SUMMARY:${event.title}
            DESCRIPTION:Ticket Ref: ${ticket.id}
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

    return (
        <div className="flex flex-col h-auto animate-fade-in pb-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-[17px] font-bold tracking-tight">Your Ticket</h2>
                <button onClick={() => window.location.reload()} className="p-2 -mr-2 text-gray-500 hover:text-black">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            {/* Ticket Card Container - Centered */}
            <div className="flex justify-center mb-6">
                <ReceiptTicket
                    id="ticket-card-element"
                    event={event}
                    ticket={ticket}
                    tierName={tierName}
                />
            </div>

            {/* Calendar & Download Actions */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                <p className="text-[11px] font-medium text-gray-500 mb-3 uppercase tracking-wider">Actions</p>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleAddToCalendar('google')}
                        className="h-9 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:border-gray-900 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
                        Google Cal
                    </button>
                    <button
                        onClick={() => handleAddToCalendar('ics')}
                        className="h-9 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:border-gray-900 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        Outlook / Apple
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <button
                    onClick={handleDownloadPDF}
                    disabled={downloading}
                    className="w-full bg-black text-white h-11 rounded-xl text-[14px] font-medium tracking-wide hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                    {downloading ? 'Generating PDF...' : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Download PDF
                        </>
                    )}
                </button>
                <button
                    onClick={() => window.open(`/api/wallet/apple?ticketId=${ticket.id}`, '_blank')}
                    className="w-full bg-black text-white h-11 rounded-xl text-[14px] font-medium tracking-wide hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12.02 0C19.2 0 24 4.54 24 11.2V24H0V11.2C0 4.54 4.8 0 11.98 0H12.02ZM6.34 21.06C6.34 21.6 6.76 22.02 7.3 22.02H16.7C17.24 22.02 17.66 21.6 17.66 21.06V11.4C17.66 8.3 15.34 6 12.02 6C8.7 6 6.34 8.3 6.34 11.4V21.06ZM12 7.82C13.68 7.82 15.06 9.2 15.06 10.88V13.5H16.5V11.4C16.5 8.92 14.48 6.9 12 6.9C9.52 6.9 7.5 8.92 7.5 11.4V13.5H8.94V10.88C8.94 9.2 10.32 7.82 12 7.82Z" />
                    </svg>
                    Add to Apple Wallet
                </button>
            </div>

            <div className="flex justify-end mt-4">
                <div className="flex items-center gap-1.5 opacity-50">
                    <span className="text-[10px] text-gray-500 font-medium">Powered by GatePass</span>
                </div>
            </div>

            {/* Hidden Ticket for PDF Generation (Target) */}
            <div className="absolute top-0 left-[-9999px]">
                <ReceiptTicket
                    id="ticket-card-hidden-print"
                    event={event}
                    ticket={ticket}
                    tierName={tierName}
                    forceExpanded={true}
                />
            </div>
        </div>
    )
}

// Receipt Style Ticket Component
const ReceiptTicket = ({ id, event, ticket, tierName, forceExpanded = false }: { id?: string, event: Event, ticket: any, tierName?: string, forceExpanded?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false)
    const showContent = isOpen || forceExpanded

    return (
        <div
            id={id}
            onClick={() => setIsOpen(!isOpen)}
            className="w-[300px] bg-[#ffffff] rounded-t-[20px] relative cursor-pointer transition-all duration-300 ease-in-out"
            style={{
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
        >
            {/* Main Content Container */}
            <div className="p-6 relative">
                {/* Header (Always Visible) */}
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white text-xl mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h3 className="text-[18px] font-bold text-gray-900 leading-tight mb-1">Payment Successful</h3>
                    <p className="text-[13px] text-gray-500 font-medium">
                        You are going to <span className="text-black">{event.title}</span>!
                    </p>
                </div>

                {/* Dashed Line + Notches */}
                <div className="relative w-[calc(100%+3rem)] -mx-6 h-8 flex items-center justify-center my-2">
                    <div className="w-full border-t-2 border-dashed border-gray-200 mx-6" />
                    <div className="absolute left-[-10px] w-5 h-5 bg-[#ffffff] border-r border-gray-100 rounded-full shadow-[inset_-2px_0_3px_rgba(0,0,0,0.02)]" />
                    <div className="absolute right-[-10px] w-5 h-5 bg-[#ffffff] border-l border-gray-100 rounded-full shadow-[inset_2px_0_3px_rgba(0,0,0,0.02)]" />
                </div>

                {/* Collapsible Section */}
                <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ticket-content-collapsible ${showContent ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pt-2 pb-4 ticket-content">
                        {/* Attendee Info */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Admit One</p>
                            <p className="text-[18px] font-bold text-gray-900 leading-none mb-1">
                                {ticket.reservations?.profiles?.full_name || ticket.reservations?.guest_name || 'Guest User'}
                            </p>
                            <p className="text-[12px] text-gray-500 font-medium">{tierName}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Date</p>
                                <p className="text-[13px] font-bold text-gray-900">
                                    {new Date(event.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Time</p>
                                <p className="text-[13px] font-bold text-gray-900">
                                    {new Date(event.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                                </p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Venue</p>
                            <p className="text-[13px] font-bold text-gray-900 truncate">
                                {event.venue_name}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{event.venue_address}</p>
                        </div>

                        {/* QR Code Area */}
                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                            <div className="p-3 bg-white border-2 border-gray-900 rounded-xl shadow-sm">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qr_code_hash}&color=000000`}
                                    alt="QR Code"
                                    className="w-32 h-32 object-contain mix-blend-multiply"
                                />
                            </div>
                            <p className="text-center text-[10px] font-mono text-gray-400 mt-3 tracking-widest uppercase">Scan at entry</p>
                        </div>
                        <p className="text-center text-[9px] font-mono text-gray-300 tracking-[0.2em] mt-1">{ticket.qr_code_hash?.substring(0, 12)}</p>
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
