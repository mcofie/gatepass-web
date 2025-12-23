'use client'

import React, { useEffect, useState } from 'react'
import Script from 'next/script'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/supabase' // Assuming types are global or accessible, but sticking to 'any' if generic

// Simple Timer Hook
const useTimer = (expiresAt: string | undefined) => {
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
        if (!expiresAt) return

        const end = new Date(expiresAt).getTime()
        const timer = setInterval(() => {
            const now = new Date().getTime()
            const dist = end - now

            if (dist < 0) {
                clearInterval(timer)
                setTimeLeft('EXPIRED')
                return
            }

            const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60))
            const s = Math.floor((dist % (1000 * 60)) / 1000)
            setTimeLeft(`${m}m ${s}s`)
        }, 1000)

        return () => clearInterval(timer)
    }, [expiresAt])

    return timeLeft
}

import { Reservation, Event, TicketTier, EventAddon } from '@/types/gatepass'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/utils/format'
import { calculateFees, FeeRates, getEffectiveFeeRates, PLATFORM_FEE_PERCENT, PROCESSOR_FEE_PERCENT } from '@/utils/fees'
import { toast } from 'sonner'

interface CheckoutClientProps {
    reservation: Reservation
    feeRates?: FeeRates
    discount?: any
    availableAddons?: EventAddon[]
}

export function CheckoutClient({ reservation, feeRates, discount, availableAddons = [] }: CheckoutClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const [paying, setPaying] = useState(false)
    const timeLeft = useTimer(reservation.expires_at)
    const [user, setUser] = useState<any>(null)

    const [guestForm, setGuestForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
    const [isGuest, setIsGuest] = useState(false)
    const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
    const [step, setStep] = useState<'details' | 'addons' | 'summary'>('details')

    // Auto-advance if no guest details needed? No, let's keep it explicit "Continue" for consistency unless directed otherwise.
    // actually if not guest, "Details" step might be empty/boring. Let's make it show "Ticket Holder: [Name]" at least.

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            const u = data.user
            setUser(u)
            if (u && u.is_anonymous) {
                setIsGuest(true)
            } else if (u) {
                // Check if profile is complete (optional, maybe just enforce for anon)
                supabase.schema('gatepass').from('profiles').select('*').eq('id', u.id).single()
                    .then(({ data: profile }) => {
                        if (profile && (!profile.full_name || !profile.phone_number)) {
                            // Could enforce updates for reg users too, but requirement asks for "if not logged in" primarily.
                            // Actually "if user is not logged in" technically means anonymous now.
                            if (!profile.full_name) setIsGuest(true) // Treat incomplete profile as needing form
                        }
                    })
            }
        })
    }, [])



    const price = reservation.ticket_tiers?.price || 0
    const quantity = reservation.quantity
    const currency = reservation.ticket_tiers?.currency || 'GHS'
    const feeBearer = (reservation.events?.fee_bearer as 'customer' | 'organizer') || 'customer'
    // const platformFeePercent = reservation.events?.platform_fee_percent || 0 // Deprecated in favor of global constant



    // Calculate Base Subtotal
    let subtotal = price * quantity
    let addonsTotal = 0

    // Add Add-ons cost
    availableAddons.forEach(addon => {
        if (selectedAddons[addon.id]) {
            addonsTotal += addon.price * selectedAddons[addon.id]
        }
    })

    subtotal += addonsTotal
    let discountAmount = 0

    // Apply Discount
    if (discount) {
        if (discount.type === 'percentage') {
            discountAmount = subtotal * (discount.value / 100)
        } else {
            discountAmount = discount.value
        }
        // Ensure we don't go below zero
        if (discountAmount > subtotal) discountAmount = subtotal

        subtotal = subtotal - discountAmount
    }

    const effectiveRates = getEffectiveFeeRates(feeRates, reservation.events)
    const { clientFees, platformFee, processorFee, customerTotal } = calculateFees(subtotal, feeBearer, effectiveRates)

    // Defaults for display if fees not passed (should be rare)
    const platformPct = (effectiveRates.platformFeePercent) * 100
    const processorPct = (effectiveRates.processorFeePercent) * 100

    // Legacy mapping: calculatedFee = clientFees (Total fees shown to customer)
    const calculatedFee = clientFees
    const paymentTotal = customerTotal

    const handlePaystack = async () => {
        if (isGuest) {
            if (!guestForm.firstName || !guestForm.lastName || !guestForm.email || !guestForm.phone) {
                toast.error('Please fill in all guest details.')
                return
            }
            // Update Profile
            setPaying(true)
            const { error } = await supabase.schema('gatepass').from('profiles').update({
                full_name: `${guestForm.firstName} ${guestForm.lastName}`,
                phone_number: guestForm.phone,
                email: guestForm.email, // Assuming checking strict types, but email on profile is good for contact
                updated_at: new Date().toISOString()
            }).eq('id', user.id)

            if (error) {
                toast.error('Error processing details: ' + error.message)
                setPaying(false)
                return
            }
        }
        // @ts-ignore
        const PaystackPop = window.PaystackPop

        if (!PaystackPop) {
            toast.error('Paystack SDK not loaded. Please refresh.')
            return
        }

        setPaying(true)

        const paymentConfig = {
            key: process.env.NEXT_PUBLIC_PAYSTACK_KEY || 'pk_live_0f67799272630fd2b3632739071b384d74294e2a',
            email: (isGuest ? guestForm.email : user?.email) || 'customer@email.com',
            amount: Math.round(paymentTotal * 100), // Paystack expects kobo/cents
            currency: currency,
            ref: reservation.id,
            callback: function (transaction: any) {
                const processPayment = async () => {
                    // Call Server API to verify and create ticket
                    const response = await fetch('/api/paystack/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reference: transaction.reference,
                            reservationId: reservation.id,
                            addons: selectedAddons
                        })
                    })

                    const result = await response.json()

                    if (!response.ok) {
                        throw new Error(result.error || 'Verification failed')
                    }

                    // Success
                    router.push('/')
                    toast.success('Payment successful! Check your email for tickets.')
                }

                processPayment().catch(err => {
                    console.error('Payment Verification Error Stack:', err)
                    toast.error(`Verification Failed: ${err.message || 'Network Error'}`)
                })
            },
            onClose: function () {
                setPaying(false)
                toast.info('Transaction cancelled')
            }
        }

        if (typeof PaystackPop.setup === 'function') {
            const handler = PaystackPop.setup(paymentConfig)
            handler.openIframe()
        } else {
            try {
                const paystack = new PaystackPop()
                paystack.newTransaction({
                    ...paymentConfig,
                    onSuccess: paymentConfig.callback,
                    onCancel: paymentConfig.onClose
                })
            } catch (e: any) {
                console.error('Paystack Init Error:', e)
                setPaying(false)
            }
        }
    }

    return (
        <>
            <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />

            <div className="w-full max-w-lg mx-auto animate-slide-up">
                {/* Premium Dark Card */}
                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">

                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Header */}
                    <div className="text-center space-y-4 mb-10 relative z-10">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-inner mb-2">
                            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white">Checkout</h1>
                            <p className="text-gray-400 text-sm mt-1">Complete your secure payment</p>
                        </div>
                    </div>

                    {/* Timer - Integrated Pill */}
                    <div className="flex justify-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-950/30 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-500 tracking-wide">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>RESERVATION EXPIRES IN {timeLeft || '...'}</span>
                        </div>
                    </div>



                    {/* STEPS PROGRESS */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex justify-center gap-2 mb-2">
                            {['details', 'addons', 'summary'].map((s, i) => (
                                <div key={s} className={cn("h-1 rounded-full transition-all duration-300", step === s ? "w-8 bg-amber-500" : (['details', 'addons', 'summary'].indexOf(step) > i ? "w-8 bg-amber-500/50" : "w-2 bg-white/10"))} />
                            ))}
                        </div>
                        {/* Debug Indicator - REMOVE BEFORE PROD */}
                        <div className="text-[10px] text-gray-600 bg-white/10 px-2 py-1 rounded mt-2">
                            Addons Available: {availableAddons.length} | ID: {reservation.event_id}
                        </div>
                    </div>

                    {/* === STEP 1: DETAILS === */}
                    {step === 'details' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {isGuest ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white/40"></span>
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Guest Details</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            placeholder="First Name"
                                            value={guestForm.firstName}
                                            onChange={e => setGuestForm({ ...guestForm, firstName: e.target.value })}
                                            className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                        />
                                        <Input
                                            placeholder="Last Name"
                                            value={guestForm.lastName}
                                            onChange={e => setGuestForm({ ...guestForm, lastName: e.target.value })}
                                            className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                        />
                                        <Input
                                            placeholder="Email"
                                            type="email"
                                            value={guestForm.email}
                                            onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
                                            className="col-span-2 bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                        />
                                        <Input
                                            placeholder="Phone Number"
                                            type="tel"
                                            value={guestForm.phone}
                                            onChange={e => setGuestForm({ ...guestForm, phone: e.target.value })}
                                            className="col-span-2 bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 space-y-4">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                        {/* Avatar or Icon */}
                                        {user?.user_metadata?.avatar_url ? (
                                            <img src={user.user_metadata.avatar_url} className="w-full h-full rounded-full object-cover" alt="User" />
                                        ) : (
                                            <div className="font-bold text-2xl text-amber-500">{user?.email?.[0].toUpperCase()}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg">Logged in as {user?.email}</h3>
                                        <p className="text-gray-500 text-sm">Your tickets will be sent to this email.</p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8">
                                <Button
                                    onClick={() => {
                                        if (isGuest && (!guestForm.firstName || !guestForm.email)) {
                                            toast.error('Please fill in your details')
                                            return
                                        }
                                        // Skip Addons if none
                                        if (availableAddons.length === 0) setStep('summary')
                                        else setStep('addons')
                                    }}
                                    className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl"
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* === STEP 2: ADD-ONS === */}
                    {step === 'addons' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4 mb-8">
                                <div className="text-center mb-6">
                                    <h2 className="text-xl font-bold text-white">Enhance Your Experience</h2>
                                    <p className="text-gray-400 text-sm">Select extras to add to your order</p>
                                </div>

                                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {availableAddons.map(addon => {
                                        const qty = selectedAddons[addon.id] || 0
                                        return (
                                            <div key={addon.id} className={cn("p-4 rounded-xl border transition-all flex items-center gap-4 bg-white/5", qty > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-white/5")}>
                                                <div className="w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0">
                                                    {addon.image_url && <img src={addon.image_url} alt={addon.name} className="w-full h-full object-cover" />}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-white text-sm">{addon.name}</h4>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <span className="text-amber-500 font-bold text-xs">{formatCurrency(addon.price, addon.currency)}</span>
                                                        {addon.description && <span className="text-xs text-gray-500 line-clamp-2">{addon.description}</span>}
                                                    </div>
                                                </div>
                                                {/* Stepper */}
                                                <div className="flex flex-col items-center gap-1 bg-black/50 p-1 rounded-lg border border-white/5">
                                                    <button
                                                        onClick={() => setSelectedAddons(prev => ({ ...prev, [addon.id]: (prev[addon.id] || 0) + 1 }))}
                                                        className="w-8 h-8 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                    <span className="text-sm font-bold tabular-nums w-4 text-center py-1">{qty}</span>
                                                    <button
                                                        onClick={() => setSelectedAddons(prev => {
                                                            const newQty = Math.max(0, (prev[addon.id] || 0) - 1)
                                                            const next = { ...prev }
                                                            if (newQty === 0) delete next[addon.id]
                                                            else next[addon.id] = newQty
                                                            return next
                                                        })}
                                                        className="w-8 h-8 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
                                                    >
                                                        -
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <Button
                                    variant="ghost"
                                    onClick={() => setStep('details')}
                                    className="flex-1 h-12 text-gray-400 hover:text-white"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setStep('summary')}
                                    className="flex-[2] h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl"
                                >
                                    Continue to Payment
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* === STEP 3: SUMMARY === */}
                    {step === 'summary' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Small Back Button */}
                            <button onClick={() => setStep(availableAddons.length > 0 ? 'addons' : 'details')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white mb-4 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                Back
                            </button>

                            <div className="space-y-6 pt-0 border-t-0 border-dashed border-white/10 relative">
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400 text-sm">Event</span>
                                    <span className="font-bold text-right max-w-[200px] text-white">{reservation.events?.title}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Details</span>
                                    <span className="font-medium text-white">{reservation.ticket_tiers?.name} <span className="text-gray-500">x {reservation.quantity}</span></span>
                                </div>

                                {/* Addon Summary Line */}
                                {Object.keys(selectedAddons).length > 0 && (
                                    <div className="flex justify-between items-start text-sm pt-2">
                                        <span className="text-gray-400">Extras</span>
                                        <div className="text-right">
                                            {Object.entries(selectedAddons).map(([id, qty]) => {
                                                const addon = availableAddons.find(a => a.id === id)
                                                if (!addon) return null
                                                return (
                                                    <div key={id} className="text-white">
                                                        {qty}x {addon.name}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 pt-6 border-t border-white/5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Subtotal</span>
                                        <span className="font-medium tabular-nums text-gray-200">{formatCurrency(price * quantity + addonsTotal, currency)}</span>
                                    </div>

                                    {discount && (
                                        <div className="flex justify-between text-sm text-green-500">
                                            <span className="">Discount ({discount.code})</span>
                                            <span className="font-medium tabular-nums">-{formatCurrency(discountAmount, currency)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Platform Fee ({platformPct}%)</span>
                                        <span className="font-medium tabular-nums text-gray-200">{formatCurrency(platformFee, currency)}</span>
                                    </div>

                                    {feeBearer === 'customer' && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Processing Fee ({processorPct}%)</span>
                                            <span className="font-medium tabular-nums text-gray-200">{formatCurrency(processorFee, currency)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end pt-4">
                                        <span className="text-sm font-medium text-gray-400">Total Due</span>
                                        <span className="text-3xl font-bold tracking-tight text-amber-500 tabular-nums">{formatCurrency(paymentTotal, currency)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <Button
                                    onClick={handlePaystack}
                                    disabled={paying}
                                    className="w-full h-14 text-lg bg-white text-black hover:bg-gray-200 font-bold shadow-xl shadow-white/10 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {paying ? 'Processing Securely...' : 'Pay Now'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest font-medium mt-6">
                                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                                Secured by Paystack
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
