'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import { TicketTier, Event } from '@/types/gatepass'
import clsx from 'clsx'

interface CheckoutModalProps {
    show: boolean
    event: Event
    tiers: TicketTier[]
    loading?: boolean
    onClose: () => void
    onCheckout: (payload: { tier: TicketTier, quantity: number }) => void
}

export function CheckoutModal({ show, event, tiers, loading, onClose, onCheckout }: CheckoutModalProps) {
    const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null)
    const [quantities, setQuantities] = useState<Record<string, number>>({})

    // Initialize quantities when tiers allow
    useEffect(() => {
        const initialQuantities: Record<string, number> = {}
        tiers.forEach(tier => {
            if (!initialQuantities[tier.id]) initialQuantities[tier.id] = 0
        })
        setQuantities(initialQuantities)
    }, [tiers])

    const increment = (tierId: string) => {
        const newQuantities = { ...quantities }
        // Reset others for single selection behavior
        Object.keys(newQuantities).forEach(key => {
            if (key !== tierId) newQuantities[key] = 0
        })
        newQuantities[tierId] = (newQuantities[tierId] || 0) + 1
        setQuantities(newQuantities)

        const tier = tiers.find(t => t.id === tierId)
        setSelectedTier(tier || null)
    }

    const decrement = (tierId: string) => {
        const newQuantities = { ...quantities }
        if ((newQuantities[tierId] || 0) > 0) {
            newQuantities[tierId] = newQuantities[tierId] - 1
            setQuantities(newQuantities)

            if (newQuantities[tierId] === 0) {
                setSelectedTier(null)
            }
        }
    }

    const total = useMemo(() => {
        if (!selectedTier) return 0
        return selectedTier.price * (quantities[selectedTier.id] || 0)
    }, [selectedTier, quantities])

    if (!show) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-6xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button onClick={onClose} className="absolute top-6 right-6 z-10 p-2 hover:bg-gray-100 rounded-full transition">
                    <X className="w-6 h-6 text-gray-500" />
                </button>

                {/* Left Column: Selection */}
                <div className="flex-1 p-8 md:p-12 overflow-y-auto border-r border-gray-100">
                    <h2 className="text-3xl font-bold mb-8">Checkout</h2>

                    {/* Stepper */}
                    <div className="flex items-center gap-4 mb-12 text-sm font-medium">
                        <div className="flex items-center gap-2 text-black">
                            <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-xs">✓</div>
                            <span>Tickets</span>
                        </div>
                        <div className="h-px w-16 bg-gray-200"></div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-xs"></div>
                            <span>Contact</span>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
                            <span className="bg-orange-500 rounded-full w-2 h-2"></span>
                            Choose Tickets
                        </h3>

                        <div className="space-y-8">
                            {tiers.map(tier => (
                                <div key={tier.id} className="border-b border-gray-100 pb-8 last:border-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-lg uppercase tracking-wide text-gray-900">{tier.name}</h4>
                                            <div className="text-orange-600 font-bold mt-1">
                                                {tier.currency} {tier.price.toFixed(2)}
                                                <span className="text-gray-400 text-xs font-normal ml-2">includes fees</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => decrement(tier.id)}
                                                className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                                disabled={!quantities[tier.id]}
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-bold">{quantities[tier.id] || 0}</span>
                                            <button
                                                onClick={() => increment(tier.id)}
                                                className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                                disabled={tier.total_quantity <= 0}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-sm leading-relaxed max-w-xl">
                                        {tier.description || 'Access to the event.'}
                                    </p>
                                    {tier.total_quantity <= 0 && (
                                        <div className="mt-2 inline-block bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded">
                                            Sold Out
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Summary */}
                <div className="w-full md:w-[400px] bg-gray-50 p-8 md:p-12 flex flex-col">
                    <h3 className="text-xl font-bold mb-8">Summary</h3>

                    {selectedTier ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col">
                            <h4 className="font-bold text-lg uppercase mb-4">{event.title}</h4>

                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-600">{selectedTier.name} x {quantities[selectedTier.id]}</span>
                                <span className="font-bold">{selectedTier.currency} {total.toFixed(2)}</span>
                            </div>

                            <div className="mt-auto pt-6 border-t border-gray-100">
                                <p className="text-center text-gray-400 text-sm mb-4">Please, choose a ticket type to continue</p>
                                <button
                                    onClick={() => onCheckout({ tier: selectedTier, quantity: quantities[selectedTier.id] })}
                                    className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg shadow-black/10 disabled:opacity-70 disabled:cursor-not-allowed"
                                    disabled={loading}
                                >
                                    {loading ? 'Processing...' : 'Checkout'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                            Select a ticket to view summary
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
