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
        } catch (error: unknown) {
            const e = error as Error
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }



    const hasSelection = calculatedTotal > 0

    return (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                Select Tickets
            </h2>

            <div className="space-y-4 mb-8">
                {tiers.map(tier => {
                    const isSoldOut = tier.quantity_sold >= tier.total_quantity
                    const isSelected = (selectedTickets[tier.id] || 0) > 0

                    return (
                        <div
                            key={tier.id}
                            className={`group relative p-4 rounded-2xl border transition-all duration-300 ${isSelected
                                ? 'bg-white/10 border-amber-500/50'
                                : 'bg-black/40 border-white/5 hover:border-white/10'
                                }`}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-base text-white truncate">{tier.name}</h3>
                                        {isSoldOut && (
                                            <span className="px-1.5 py-0.5 bg-white/10 text-gray-400 text-[10px] font-bold rounded uppercase tracking-wide">Sold Out</span>
                                        )}
                                    </div>
                                    <div className="text-lg font-bold text-amber-500 tabular-nums">
                                        {tier.currency} {tier.price.toFixed(2)}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-black/50 rounded-full p-1 border border-white/10">
                                    <button
                                        onClick={() => handleQuantityChange(tier.id, -1)}
                                        disabled={!selectedTickets[tier.id] || isSoldOut}
                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-all"
                                    >
                                        -
                                    </button>
                                    <span className="w-4 text-center font-bold text-sm text-white tabular-nums">{selectedTickets[tier.id] || 0}</span>
                                    <button
                                        onClick={() => handleQuantityChange(tier.id, 1)}
                                        disabled={isSoldOut}
                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 disabled:opacity-30 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {tiers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-white/5 rounded-2xl text-sm">
                        No tickets available.
                    </div>
                )}
            </div>

            {/* Summary Section */}
            <div className="pt-6 border-t border-white/10 space-y-4">
                {hasSelection ? (
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm text-gray-400">
                            <span>Subtotal</span>
                            <span>{tiers[0]?.currency} {calculatedTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-end text-white">
                            <span className="font-bold">Total</span>
                            <span className="text-2xl font-bold text-amber-500 tabular-nums">{tiers[0]?.currency} {calculatedTotal.toFixed(2)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-sm text-gray-600 italic py-2">
                        Select tickets to proceed
                    </div>
                )}

                <button
                    onClick={handleCheckout}
                    disabled={!hasSelection || loading}
                    className="w-full bg-amber-500 text-black py-4 rounded-xl font-bold text-lg shadow-lg shadow-amber-900/20 hover:bg-amber-400 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                >
                    {loading ? 'Processing...' : 'Get Tickets'}
                </button>

                <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest pt-2">
                    Powered by Gatepass
                </p>
            </div>

            {/* Mobile Buttom Sheet (Only visible on small screens when sticky sidebar is hidden/stacked) */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-zinc-900/90 backdrop-blur-xl lg:hidden transition-transform duration-300 z-50 ${hasSelection ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-gray-400 uppercase font-bold">Total</p>
                        <p className="text-xl font-bold text-white tabular-nums">
                            {tiers[0]?.currency} {calculatedTotal.toFixed(2)}
                        </p>
                    </div>
                    <button
                        onClick={handleCheckout}
                        className="bg-amber-500 text-black px-8 py-3 rounded-full font-bold hover:bg-amber-400 transition-colors"
                    >
                        Checkout
                    </button>
                </div>
            </div>
        </div>
    )
}
