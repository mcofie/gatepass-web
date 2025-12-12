'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { createReservation } from '@/utils/gatepass'

function GuestCheckoutContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [guestDetails, setGuestDetails] = useState({ firstName: '', lastName: '', email: '', phone: '' })
    const [event, setEvent] = useState<any>(null)
    const [tier, setTier] = useState<any>(null)

    const eventId = searchParams.get('eventId')
    const tierId = searchParams.get('tierId')
    const quantity = parseInt(searchParams.get('qty') || '0', 10)

    useEffect(() => {
        if (!eventId || !tierId || quantity <= 0) {
            router.push('/')
            return
        }

        const fetchData = async () => {
            const { data: eventData } = await supabase.schema('gatepass').from('events').select('*').eq('id', eventId).single()
            const { data: tierData } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('id', tierId).single()

            if (eventData) setEvent(eventData)
            if (tierData) setTier(tierData)
        }

        fetchData()
    }, [eventId, tierId, quantity, router, supabase])

    const handleGuestSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Attempt to create a user for the guest
            const { data, error } = await supabase.auth.signUp({
                email: guestDetails.email,
                password: `GuestPass_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                options: {
                    data: {
                        full_name: `${guestDetails.firstName} ${guestDetails.lastName}`,
                        phone_number: guestDetails.phone
                    }
                }
            })

            if (error) throw error

            if (data.user) {
                // Ensure profile is updated
                await supabase.schema('gatepass').from('profiles').upsert({
                    id: data.user.id,
                    full_name: `${guestDetails.firstName} ${guestDetails.lastName}`,
                    phone_number: guestDetails.phone,
                    email: guestDetails.email,
                    updated_at: new Date().toISOString()
                })

                // Create Reservation
                if (eventId && tierId) {
                    const reservation = await createReservation(eventId, tierId, data.user.id, quantity, supabase)
                    if (reservation && reservation.id) {
                        router.push(`/checkout/${reservation.id}`)
                    } else {
                        throw new Error('Failed to create reservation.')
                    }
                }
            }
        } catch (e: any) {
            if (e.message?.includes('already registered')) {
                alert('An account with this email already exists. Please log in first.')
                router.push(`/login?redirect=/events/${eventId}`) // Redirect back to event? Or Login?
            } else {
                alert('Error processing guest checkout: ' + e.message)
            }
        } finally {
            setLoading(false)
        }
    }

    if (!eventId || !tierId) return null

    const totalPrice = tier ? tier.price * quantity : 0
    const currency = tier?.currency || 'GHS'

    return (
        <div className="min-h-screen bg-white dark:bg-black pt-24 pb-12 px-4">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12">
                {/* Left Column: Form */}
                <div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Guest Checkout</h1>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">Enter your details to proceed.</p>

                        <form onSubmit={handleGuestSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">First Name</label>
                                    <input
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        value={guestDetails.firstName}
                                        onChange={e => setGuestDetails({ ...guestDetails, firstName: e.target.value })}
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Last Name</label>
                                    <input
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        value={guestDetails.lastName}
                                        onChange={e => setGuestDetails({ ...guestDetails, lastName: e.target.value })}
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                    value={guestDetails.email}
                                    onChange={e => setGuestDetails({ ...guestDetails, email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Phone Number</label>
                                <input
                                    type="tel"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                    value={guestDetails.phone}
                                    onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })}
                                    placeholder="+233 20 123 4567"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg"
                                >
                                    {loading ? 'Processing...' : `Pay ${currency} ${totalPrice.toFixed(2)}`}
                                </button>
                                <p className="text-center text-xs text-gray-400 mt-4">
                                    By continuing, you agree to our Terms of Service.
                                </p>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Column: Order Summary */}
                <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 h-fit sticky top-24">
                        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Order Summary</h2>

                        {event && (
                            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-lg mb-1">{event.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(event.start_time).toLocaleDateString()} • {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{event.location}</p>
                            </div>
                        )}

                        {tier && (
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Ticket Type</span>
                                    <span className="font-medium text-right">{tier.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Quantity</span>
                                    <span className="font-medium text-right">x {quantity}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Price per ticket</span>
                                    <span className="font-medium text-right">{tier.currency} {tier.price.toFixed(2)}</span>
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">Total</span>
                                        <span className="font-bold text-2xl">{tier.currency} {(tier.price * quantity).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!event && !tier && (
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                                <div className="space-y-2 pt-4">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function GuestCheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <GuestCheckoutContent />
        </Suspense>
    )
}
