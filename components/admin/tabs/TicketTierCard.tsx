'use client'

import React, { useState } from 'react'
import { Ticket, Edit2, Check, Trash2, X, Eye, EyeOff, Plus, GripVertical } from 'lucide-react'
import { TicketTier, Event } from '@/types/gatepass'
import { formatCurrency } from '@/utils/format'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TicketTierCardProps {
    tier: TicketTier
    event: Event
    isStaff?: boolean
    onUpdate: (tierId: string, data: any) => Promise<void>
    onDelete: (tierId: string) => void
    onToggleVisibility: (tierId: string, currentVisibility: boolean) => void
    isEditing: boolean
    onEditStart: () => void
    onEditCancel: () => void
}

export function TicketTierCard({
    tier,
    event,
    isStaff,
    onUpdate,
    onDelete,
    onToggleVisibility,
    isEditing,
    onEditStart,
    onEditCancel
}: TicketTierCardProps) {
    // Local form state for editing
    const [editForm, setEditForm] = useState({
        name: tier.name,
        price: tier.price,
        total_quantity: tier.total_quantity,
        max_per_order: tier.max_per_order || 10,
        description: tier.description || '',
        perks: tier.perks || []
    })
    const [editPerk, setEditPerk] = useState('')

    // Sync form with tier prop
    React.useEffect(() => {
        setEditForm({
            name: tier.name,
            price: tier.price,
            total_quantity: tier.total_quantity,
            max_per_order: tier.max_per_order || 10,
            description: tier.description || '',
            perks: tier.perks || []
        })
    }, [tier])

    // Draggable hooks
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tier.id, disabled: isEditing || isStaff })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    }

    const handleSave = async () => {
        await onUpdate(tier.id, editForm)
        onEditCancel()
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group bg-white dark:bg-[#111] border border-gray-100 dark:border-white/10 rounded-3xl p-6 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300"
        >
            {isEditing ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Name</label>
                            <input
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 font-bold text-sm text-gray-900 dark:text-white"
                                placeholder="Ticket Name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Price</label>
                            <input
                                type="number"
                                value={editForm.price}
                                onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 font-bold text-sm text-gray-900 dark:text-white"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Total Qty</label>
                            <input
                                type="number"
                                value={editForm.total_quantity}
                                onChange={e => setEditForm({ ...editForm, total_quantity: parseInt(e.target.value) })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 font-bold text-sm text-gray-900 dark:text-white"
                                placeholder="100"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Max / Order</label>
                            <input
                                type="number"
                                value={editForm.max_per_order}
                                onChange={e => setEditForm({ ...editForm, max_per_order: parseInt(e.target.value) })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 font-bold text-sm text-gray-900 dark:text-white"
                                placeholder="10"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Perks</label>
                        <div className="space-y-2 mb-2">
                            {editForm.perks?.map((perk: string, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-2 rounded-lg text-sm font-bold dark:text-gray-300">
                                    <span>{perk}</span>
                                    <button
                                        type="button"
                                        onClick={() => setEditForm({ ...editForm, perks: editForm.perks.filter((_, idx) => idx !== i) })}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={editPerk}
                                onChange={e => setEditPerk(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        if (editPerk.trim()) {
                                            setEditForm({ ...editForm, perks: [...(editForm.perks || []), editPerk.trim()] })
                                            setEditPerk('')
                                        }
                                    }
                                }}
                                className="flex-1 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 font-bold text-sm text-gray-900 dark:text-white"
                                placeholder="Add a perk..."
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (editPerk.trim()) {
                                        setEditForm({ ...editForm, perks: [...(editForm.perks || []), editPerk.trim()] })
                                        setEditPerk('')
                                    }
                                }}
                                className="bg-black dark:bg-white text-white dark:text-black p-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Description</label>
                        <textarea
                            value={editForm.description}
                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-lg p-2 font-medium text-sm text-gray-900 dark:text-white min-h-[80px] resize-none"
                            placeholder="Ticket description..."
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={onEditCancel} className="px-4 py-2 text-sm text-gray-500 font-bold">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold flex items-center gap-2">
                            <Check className="w-4 h-4" /> Save
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                        {/* Drag Handle */}
                        {!isStaff && (
                            <div
                                {...attributes}
                                {...listeners}
                                className="mt-1 -ml-2 p-1.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors self-start"
                            >
                                <GripVertical className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className={`font-bold text-xl ${tier.is_visible === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{tier.name}</h3>
                                <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {tier.quantity_sold} / {tier.total_quantity} Sold
                                </span>
                                {tier.is_visible === false && (
                                    <span className="px-2.5 py-0.5 bg-red-50 dark:bg-red-500/10 rounded-full text-xs font-bold text-red-500 uppercase tracking-wide flex items-center gap-1">
                                        <EyeOff className="w-3 h-3" /> Hidden
                                    </span>
                                )}
                            </div>
                            <p className={`text-sm max-w-md ${tier.is_visible === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>{tier.description}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-bold mb-2 ${tier.is_visible === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {formatCurrency(tier.price, event.currency)}
                        </div>
                        {!isStaff && (
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onToggleVisibility(tier.id, tier.is_visible !== false)}
                                    className={`p-2 rounded-lg transition-colors ${tier.is_visible === false
                                        ? 'hover:bg-green-50 dark:hover:bg-green-500/10 text-gray-400 hover:text-green-500'
                                        : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600'}`}
                                    title={tier.is_visible === false ? 'Show on event page' : 'Hide from event page'}
                                >
                                    {tier.is_visible === false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={onEditStart}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(tier.id)}
                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!isEditing && (
                <div className="mt-6 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-black dark:bg-white rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${(tier.quantity_sold / tier.total_quantity) * 100}%` }}
                    />
                </div>
            )}
        </div>
    )
}
