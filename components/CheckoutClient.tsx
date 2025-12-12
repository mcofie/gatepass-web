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
    const feeBearer = reservation.events?.fee_bearer || 'customer'
    const platformFeePercent = reservation.events?.platform_fee_percent || 0

    const subtotal = price * quantity
    const calculatedFee = (subtotal * platformFeePercent) / 100
    // If customer bears fee, add it. Otherwise, absorb it (total stays subtotal).
    const paymentTotal = feeBearer === 'customer' ? subtotal + calculatedFee : subtotal

    const handlePaystack = async () => {
        if (isGuest) {
            if (!guestForm.firstName || !guestForm.lastName || !guestForm.email || !guestForm.phone) {
                alert('Please fill in all guest details.')
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
                alert('Error processing details: ' + error.message)
                setPaying(false)
                return
            }
        }
        // @ts-ignore
        const PaystackPop = window.PaystackPop

        if (!PaystackPop) {
            alert('Paystack SDK not loaded. Please refresh.')
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
                    alert('Payment successful but verification failed: ' + err.message)
                })
            },
            onClose: function () {
                setPaying(false)
                alert('Transaction cancelled')
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

            <div className="w-full max-w-lg bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="bg-black text-white p-4 text-center font-bold">
                    Time remaining: {timeLeft || '...'}
                </div>

                <div className="p-8">
                    {/* Guest Form Section */}
                    {isGuest && (
                        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-4">Guest Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    placeholder="First Name"
                                    value={guestForm.firstName}
                                    onChange={e => setGuestForm({ ...guestForm, firstName: e.target.value })}
                                    className="px-3 py-2 border rounded focus:ring-black focus:outline-none"
                                />
                                <input
                                    placeholder="Last Name"
                                    value={guestForm.lastName}
                                    onChange={e => setGuestForm({ ...guestForm, lastName: e.target.value })}
                                    className="px-3 py-2 border rounded focus:ring-black focus:outline-none"
                                />
                                <input
                                    placeholder="Email"
                                    type="email"
                                    value={guestForm.email}
                                    onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
                                    className="col-span-2 px-3 py-2 border rounded focus:ring-black focus:outline-none"
                                />
                                <input
                                    placeholder="Phone Number"
                                    type="tel"
                                    value={guestForm.phone}
                                    onChange={e => setGuestForm({ ...guestForm, phone: e.target.value })}
                                    className="col-span-2 px-3 py-2 border rounded focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <h1 className="text-2xl font-bold mb-6">Complete Payment</h1>

                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Event</span>
                            <span className="font-medium text-right">{reservation.events?.title}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Ticket Type</span>
                            <span className="font-medium">{reservation.ticket_tiers?.name} x {reservation.quantity}</span>
                        </div>

                        <div className="border-t border-dashed my-2"></div>

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-medium">{currency} {subtotal.toFixed(2)}</span>
                        </div>

                        {feeBearer === 'customer' && calculatedFee > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Fees</span>
                                <span className="font-medium">{currency} {calculatedFee.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-lg font-bold border-t pt-4">
                            <span>Total</span>
                            <span>{currency} {paymentTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        onClick={handlePaystack}
                        disabled={paying}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50"
                    >
                        {paying ? 'Processing...' : `Pay ${currency} ${paymentTotal.toFixed(2)}`}
                    </button>

                    <p className="text-xs text-center text-gray-400 mt-4">
                        Secured by Paystack
                    </p>
                </div>
            </div>
        </>
    )
}
