'use client'

import React from 'react'
import { Plus, Trash2, Tag } from 'lucide-react'
import { TicketTier } from '@/types/gatepass'

interface TicketManagerProps {
    tiers: Partial<TicketTier>[]
    onChange: (tiers: Partial<TicketTier>[]) => void
    currency?: string
}

export function TicketManager({ tiers, onChange, currency = 'GHS' }: TicketManagerProps) {
    const addTier = () => {
        const newTier: Partial<TicketTier> = {
            id: `temp-${Date.now()}`, // Temp ID
            name: '',
            price: 0,
            total_quantity: 100,
            description: '',
            currency: currency,
            quantity_sold: 0
        }
        onChange([...tiers, newTier])
    }

    const removeTier = (index: number) => {
        const newTiers = [...tiers]
        newTiers.splice(index, 1)
        onChange(newTiers)
    }

    const updateTier = (index: number, field: keyof TicketTier, value: any) => {
        const newTiers = [...tiers]
        newTiers[index] = { ...newTiers[index], [field]: value }
        onChange(newTiers)
    }

    return (
        <div className="space-y-4">
            {tiers.map((tier, index) => (
                <div key={tier.id || index} className="p-4 bg-gray-50 border border-gray-200 rounded-xl relative group transition-all hover:bg-white hover:shadow-sm">
                    <button
                        type="button"
                        onClick={() => removeTier(index)}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid md:grid-cols-2 gap-4 pr-10">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ticket Name</label>
                            <input
                                type="text"
                                value={tier.name}
                                onChange={(e) => updateTier(index, 'name', e.target.value)}
                                placeholder="e.g. Early Bird"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-medium text-sm transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Price ({currency})</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tier.price}
                                    onChange={(e) => updateTier(index, 'price', parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-medium text-sm transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={tier.total_quantity}
                                    onChange={(e) => updateTier(index, 'total_quantity', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-medium text-sm transition-all"
                                />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                            <input
                                type="text"
                                value={tier.description || ''}
                                onChange={(e) => updateTier(index, 'description', e.target.value)}
                                placeholder="Includes VIP access..."
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-medium text-sm transition-all"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Perks (Comma separated)</label>
                            <input
                                type="text"
                                value={tier.perks?.join(', ') || ''}
                                onChange={(e) => updateTier(index, 'perks', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="e.g. Free Drink, VIP Entry, Exclusive Badge"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-medium text-sm transition-all"
                            />
                        </div>
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={addTier}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 hover:text-black hover:bg-gray-50 transition-all font-bold text-sm flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" />
                Add Ticket Tier
            </button>
        </div>
    )
}
