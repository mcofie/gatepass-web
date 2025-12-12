'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Event, TicketTier } from '@/types/gatepass'
import { CheckoutModal } from '@/components/CheckoutModal'
import { createClient } from '@/utils/supabase/client'
import { createReservation } from '@/utils/gatepass'

interface EventDetailClientProps {
    event: Event
    tiers: TicketTier[]
}


export function EventDetailClient({ event, tiers }: EventDetailClientProps) {
    const [loading, setLoading] = useState(false)
    const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({})

    const router = useRouter()
    const supabase = createClient()

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

    const processCheckout = async (userId: string) => {
        const firstTierId = Object.keys(selectedTickets).find(id => selectedTickets[id] > 0)
        if (!firstTierId) return
        const qty = selectedTickets[firstTierId]
        const reservation = await createReservation(event.id, firstTierId, userId, qty, supabase)
        if (reservation && reservation.id) {
            router.push(`/checkout/${reservation.id}`)
        } else {
            alert('Failed to create reservation.')
        }
    }

    const handleCheckout = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                await processCheckout(user.id)
            } else {
                // Redirect to Dedicated Guest Checkout Page
                const firstTierId = Object.keys(selectedTickets).find(id => selectedTickets[id] > 0)
                if (!firstTierId) return
                const qty = selectedTickets[firstTierId]

                router.push(`/checkout/guest?eventId=${event.id}&tierId=${firstTierId}&qty=${qty}`)
            }
        } catch (e: any) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }



    const hasSelection = calculatedTotal > 0

    return (
        <div className="pt-2">
            <h2 className="text-xl font-bold mb-6 md:mb-8 flex items-center gap-2 text-gray-900 dark:text-white">
                Tickets
            </h2>



            <div className="grid lg:grid-cols-12 gap-8 md:gap-16 pb-24 lg:pb-0">
                {/* Ticket List */}
                <div className="lg:col-span-7 space-y-2">
                    {tiers.map(tier => (
                        <div key={tier.id} className="py-6 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors md:-mx-4 md:px-4 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                                <div className="pr-4">
                                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{tier.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-light leading-relaxed max-w-sm">
                                        Access to regular festival entry points and amenities.
                                    </p>
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <p className="font-semibold text-lg text-gray-900 dark:text-white">
                                        {tier.currency} {tier.price.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                        + fees
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-6">
                                <div>
                                    {tier.quantity_sold >= tier.total_quantity && (
                                        <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-semibold rounded">SOLD OUT</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 rounded-full p-1 border border-gray-200/50 dark:border-gray-700/50">
                                    <button
                                        onClick={() => handleQuantityChange(tier.id, -1)}
                                        disabled={!selectedTickets[tier.id]}
                                        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 rounded-full transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        -
                                    </button>
                                    <span className="w-4 text-center font-medium text-sm text-gray-900 dark:text-white tabular-nums">{selectedTickets[tier.id] || 0}</span>
                                    <button
                                        onClick={() => handleQuantityChange(tier.id, 1)}
                                        className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 rounded-full transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {tiers.length === 0 && (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-600 font-light">
                            No tickets available.
                        </div>
                    )}
                </div>

                {/* Desktop Summary Panel (Hidden on Mobile) */}
                <div className="hidden lg:block lg:col-span-5">
                    <div className="sticky top-8 bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-2xl p-8">
                        <h3 className="font-semibold text-lg mb-6 text-gray-900 dark:text-white">Summary</h3>

                        <div className="space-y-3 mb-8 min-h-[100px]">
                            {Object.entries(selectedTickets).map(([id, qty]) => {
                                if (qty === 0) return null
                                const t = tiers.find(x => x.id === id)
                                if (!t) return null
                                return (
                                    <div key={id} className="flex justify-between text-sm py-1">
                                        <span className="text-gray-600 dark:text-gray-400">{qty} x {t.name}</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{t.currency} {(t.price * qty).toFixed(2)}</span>
                                    </div>
                                )
                            })}

                            {calculatedTotal === 0 && (
                                <div className="h-full flex items-center text-gray-400 dark:text-gray-600 text-sm font-light">
                                    Select tickets to proceed
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-6 space-y-6">
                            <div className="flex justify-between items-center text-xl font-bold text-gray-900 dark:text-white">
                                <span>Total</span>
                                <span>{tiers[0]?.currency || 'GHS'} {calculatedTotal.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={!hasSelection || loading}
                                className="w-full bg-[#FF5722] text-white py-4 rounded-xl font-semibold shadow-lg shadow-[#FF5722]/20 hover:shadow-[#FF5722]/30 hover:brightness-110 transition-all transform active:scale-95 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                            >
                                {loading ? 'Processing...' : 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Fixed Bar (Visible only on Mobile) */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 lg:hidden transition-transform duration-300 z-50 ${hasSelection ? 'translate-y-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]' : 'translate-y-full'}`}>
                <div className="flex items-center gap-4 max-w-lg mx-auto">
                    <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                            {tiers[0]?.currency || 'GHS'} {calculatedTotal.toFixed(2)}
                        </p>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={!hasSelection || loading}
                        className="bg-[#FF5722] text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-[#FF5722]/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? '...' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    )
}
