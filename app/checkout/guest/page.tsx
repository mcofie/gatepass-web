'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { createReservation } from '@/utils/gatepass'
import { Event, TicketTier } from '@/types/gatepass'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function GuestCheckoutContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [guestDetails, setGuestDetails] = useState({ firstName: '', lastName: '', email: '', phone: '' })
    const [event, setEvent] = useState<Event | null>(null)
    const [tier, setTier] = useState<TicketTier | null>(null)

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
        } catch (error: unknown) {
            const e = error as Error
            if (e.message?.includes('already registered')) {
                alert('An account with this email already exists. Please log in first.')
                router.push(`/login?redirect=/events/${eventId}`)
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
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left Column: Event Visuals (Animated Spotlights) */}
            <div className="relative hidden lg:flex flex-col justify-between p-12 bg-black text-white overflow-hidden">
                {/* Animated Spotlights */}
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[4s]"></div>
                    <div className="absolute top-[10%] right-[20%] w-[400px] h-[400px] bg-amber-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-1000 duration-[5s]"></div>
                    <div className="absolute bottom-[-10%] left-[30%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[140px] mix-blend-screen animate-pulse delay-2000 duration-[7s]"></div>
                </div>

                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_90%)] z-0"></div>

                <div className="relative z-10 animate-fade-in text-amber-500 font-mono text-sm uppercase tracking-widest mb-8 border border-white/10 bg-white/5 rounded-full px-4 py-1.5 inline-block self-start backdrop-blur-md">
                    Secure Checkout
                </div>

                <div className="relative z-10 space-y-8 max-w-lg">
                    {event ? (
                        <div className="space-y-6">
                            <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter leading-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 animate-slide-up">
                                {event.title}
                            </h1>
                            <div className="flex flex-col gap-3 text-xl text-gray-300 animate-slide-up font-light" style={{ animationDelay: '0.1s' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <p>{new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    </div>
                                    <p>{event.venue_name}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-pulse space-y-4">
                            <div className="h-16 bg-white/10 rounded-2xl w-3/4"></div>
                            <div className="h-8 bg-white/10 rounded-xl w-1/2"></div>
                        </div>
                    )}
                </div>

                <div className="relative z-10 mt-auto pt-12 border-t border-white/10">
                    <div className="flex items-center gap-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                        <span>Powered by Gatepass</span>
                        <div className="h-1 w-1 rounded-full bg-gray-700"></div>
                        <span>Secure SSL Encryption</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Checkout Form (Premium Dark) */}
            <div className="flex flex-col justify-center p-6 lg:p-12 xl:p-24 bg-black relative">
                <div className="max-w-md mx-auto w-full space-y-8 relative z-10">
                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-white">Complete Order</h2>
                        <p className="text-gray-400">Enter your details to receive your ticket.</p>
                    </div>

                    {/* Premium Card Container */}
                    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
                        {/* Subtle Ambient Light */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>

                        {/* Order Summary */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="text-gray-400">Ticket Type</span>
                                <span className="font-medium text-white">{tier?.name} <span className="text-gray-500 text-xs ml-1">x {quantity}</span></span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-gray-400 text-sm">Total Amount</span>
                                <span className="text-2xl font-bold tracking-tight text-white">{currency} <span className="text-amber-500">{totalPrice.toFixed(2)}</span></span>
                            </div>
                        </div>

                        <div className="h-px w-full bg-white/5"></div>

                        <form onSubmit={handleGuestSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-1">First Name</label>
                                    <Input
                                        required
                                        placeholder="John"
                                        value={guestDetails.firstName}
                                        onChange={e => setGuestDetails({ ...guestDetails, firstName: e.target.value })}
                                        className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-1">Last Name</label>
                                    <Input
                                        required
                                        placeholder="Doe"
                                        value={guestDetails.lastName}
                                        onChange={e => setGuestDetails({ ...guestDetails, lastName: e.target.value })}
                                        className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-1">Email</label>
                                <Input
                                    required
                                    type="email"
                                    placeholder="john@example.com"
                                    value={guestDetails.email}
                                    onChange={e => setGuestDetails({ ...guestDetails, email: e.target.value })}
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-1">Phone</label>
                                <Input
                                    required
                                    type="tel"
                                    placeholder="+233 20 123 4567"
                                    value={guestDetails.phone}
                                    onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })}
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 text-lg bg-white text-black hover:bg-gray-200 font-bold shadow-xl shadow-white/10 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
                            >
                                {loading ? 'Processing...' : 'Continue to Payment'}
                            </Button>

                            <p className="text-center text-[10px] text-gray-500 uppercase tracking-widest">
                                Secure Encrypted Transaction
                            </p>
                        </form>
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
