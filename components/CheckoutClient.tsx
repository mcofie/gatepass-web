'use client'

import React, { useEffect, useState } from 'react'
import Script from 'next/script'
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

import { Reservation, Event, TicketTier } from '@/types/gatepass'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import { toast } from 'sonner'

interface CheckoutClientProps {
    reservation: Reservation
}

export function CheckoutClient({ reservation }: CheckoutClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const [paying, setPaying] = useState(false)
    const timeLeft = useTimer(reservation.expires_at)
    const [user, setUser] = useState<any>(null)

    const [guestForm, setGuestForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
    const [isGuest, setIsGuest] = useState(false)

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

    const subtotal = price * quantity
    const { clientFees, platformFee, processorFee, customerTotal } = calculateFees(subtotal, feeBearer)

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
                            reservationId: reservation.id
                        })
                    })

                    const result = await response.json()

                    if (!response.ok) {
                        throw new Error(result.error || 'Verification failed')
                    }

                    // Success
                    router.push('/my-tickets')
                }

                processPayment().catch(err => {
                    console.error('Payment Verification Error:', err)
                    toast.error('Payment successful but verification failed: ' + err.message)
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

                    {/* Guest Form Section */}
                    {isGuest && (
                        <div className="space-y-6 mb-8 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/40"></span>
                                <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500">Guest Details</h3>
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
                    )}

                    {/* Ticket Summary */}
                    <div className="space-y-6 pt-6 border-t border-dashed border-white/10 relative">
                        {/* Cutout circles for 'ticket' effect */}
                        <div className="absolute -left-12 top-[-1px] w-6 h-6 bg-black rounded-full"></div>
                        <div className="absolute -right-12 top-[-1px] w-6 h-6 bg-black rounded-full"></div>

                        <div className="flex justify-between items-start">
                            <span className="text-gray-400 text-sm">Event</span>
                            <span className="font-bold text-right max-w-[200px] text-white">{reservation.events?.title}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Details</span>
                            <span className="font-medium text-white">{reservation.ticket_tiers?.name} <span className="text-gray-500">x {reservation.quantity}</span></span>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-white/5">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Subtotal</span>
                                <span className="font-medium tabular-nums text-gray-200">{formatCurrency(subtotal, currency)}</span>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Platform Fee (4%)</span>
                                <span className="font-medium tabular-nums text-gray-200">{formatCurrency(platformFee, currency)}</span>
                            </div>

                            {feeBearer === 'customer' && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Processing Fee (1.95%)</span>
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
            </div>
        </>
    )
}
