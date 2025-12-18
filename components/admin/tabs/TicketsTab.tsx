import React, { useState } from 'react'
import { Plus, Ticket, Edit2, Check, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { TicketTier, Event } from '@/types/gatepass'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/utils/format'

interface TicketsTabProps {
    event: Event
    tiers: TicketTier[]
    onTiersUpdate: (tiers: TicketTier[]) => void
}

export function TicketsTab({ event, tiers, onTiersUpdate }: TicketsTabProps) {
    // Local UI state
    const [creatingTier, setCreatingTier] = useState(false)
    const [editingTierId, setEditingTierId] = useState<string | null>(null)

    const [tierForm, setTierForm] = useState<{ name: string, price: number, total_quantity: number, max_per_order: number, description: string, perks: string[] }>({
        name: '', price: 0, total_quantity: 100, max_per_order: 10, description: '', perks: []
    })

    const [editForm, setEditForm] = useState<{ name: string, price: number, total_quantity: number, max_per_order: number, description: string, perks: string[] }>({
        name: '', price: 0, total_quantity: 0, max_per_order: 0, description: '', perks: []
    })

    const [newPerk, setNewPerk] = useState('')
    const [editPerk, setEditPerk] = useState('')

    const supabase = createClient()

    const fetchTiers = async () => {
        const { data } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', event.id).order('price')
        if (data) onTiersUpdate(data as TicketTier[])
    }

    const handleAddTier = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreatingTier(true)

        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('ticket_tiers')
                .insert({
                    event_id: event.id,
                    ...tierForm
                })
                .select()
                .single()

            if (data) {
                // Optimistic update or refetch
                onTiersUpdate([...tiers, data])
                setTierForm({ name: '', price: 0, total_quantity: 100, max_per_order: 10, description: '', perks: [] })
                toast.success('Ticket tier created')
            } else {
                toast.error(error?.message)
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setCreatingTier(false)
        }
    }

    const handleUpdateTier = async (tierId: string) => {
        const { data, error } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .update(editForm)
            .eq('id', tierId)
            .select()
            .single()

        if (data) {
            onTiersUpdate(tiers.map(t => t.id === tierId ? data : t))
            setEditingTierId(null)
            toast.success('Ticket updated')
        } else {
            toast.error(error?.message)
        }
    }

    const handleDeleteTier = (tierId: string) => {
        toast('Are you sure you want to delete this ticket tier?', {
            action: {
                label: 'Delete',
                onClick: async () => {
                    const { error } = await supabase
                        .schema('gatepass')
                        .from('ticket_tiers')
                        .delete()
                        .eq('id', tierId)

                    if (!error) {
                        onTiersUpdate(tiers.filter(t => t.id !== tierId))
                        toast.success('Ticket tier deleted')
                    } else {
                        toast.error(error.message)
                    }
                }
            }
        })
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Create Tier Form */}
                <div className="md:col-span-1 border border-gray-100 rounded-3xl p-6 bg-white shadow-sm h-fit">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-black rounded-xl">
                            <Ticket className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900">Create Ticket</h3>
                    </div>
                    <form onSubmit={handleAddTier} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Ticket Name</label>
                            <input
                                value={tierForm.name}
                                onChange={e => setTierForm({ ...tierForm, name: e.target.value })}
                                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all font-bold text-gray-900 placeholder:font-medium"
                                placeholder="e.g. Early Bird"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Price</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={tierForm.price}
                                        onChange={e => setTierForm({ ...tierForm, price: parseFloat(e.target.value) })}
                                        className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 pl-7 text-sm focus:ring-2 focus:ring-black outline-none transition-all font-bold text-gray-900"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Total Qty</label>
                                <input
                                    type="number"
                                    value={tierForm.total_quantity}
                                    onChange={e => setTierForm({ ...tierForm, total_quantity: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all font-bold text-gray-900"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Max / Order</label>
                                <input
                                    type="number"
                                    value={tierForm.max_per_order}
                                    onChange={e => setTierForm({ ...tierForm, max_per_order: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all font-bold text-gray-900"
                                    placeholder="10"
                                />
                            </div>
                        </div>

                        {/* Perks */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Perks</label>
                            <div className="space-y-2 mb-2">
                                {tierForm.perks.map((perk, i) => (
                                    <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg text-sm font-bold">
                                        <span>{perk}</span>
                                        <button
                                            type="button"
                                            onClick={() => setTierForm({ ...tierForm, perks: tierForm.perks.filter((_, idx) => idx !== i) })}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={newPerk}
                                    onChange={e => setNewPerk(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (newPerk.trim()) {
                                                setTierForm({ ...tierForm, perks: [...tierForm.perks, newPerk.trim()] })
                                                setNewPerk('')
                                            }
                                        }
                                    }}
                                    className="flex-1 bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all font-bold text-gray-900"
                                    placeholder="Add a perk..."
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newPerk.trim()) {
                                            setTierForm({ ...tierForm, perks: [...tierForm.perks, newPerk.trim()] })
                                            setNewPerk('')
                                        }
                                    }}
                                    className="bg-black text-white p-3 rounded-xl hover:bg-gray-800"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Description</label>
                            <textarea
                                value={tierForm.description}
                                onChange={e => setTierForm({ ...tierForm, description: e.target.value })}
                                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all font-medium text-gray-900 min-h-[80px] resize-none"
                                placeholder="Includes access to..."
                            />
                        </div>

                        <button
                            disabled={creatingTier}
                            className="w-full bg-black text-white py-4 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                        >
                            {creatingTier ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" /> Create Ticket
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Tiers List */}
                <div className="md:col-span-2 space-y-4">
                    {tiers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in bg-gray-50/50 rounded-3xl border border-gray-100 border-dashed">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                                <Ticket className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No Tickets Created</h3>
                            <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                Create your first ticket type using the form on the left to start selling.
                            </p>
                        </div>
                    ) : (
                        tiers.map((tier) => (
                            <div key={tier.id} className="group bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300">
                                {editingTierId === tier.id ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Name</label>
                                                <input
                                                    value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 font-bold text-sm text-gray-900"
                                                    placeholder="Ticket Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Price</label>
                                                <input
                                                    type="number"
                                                    value={editForm.price}
                                                    onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                                                    className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 font-bold text-sm text-gray-900"
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
                                                    className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 font-bold text-sm text-gray-900"
                                                    placeholder="100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Max / Order</label>
                                                <input
                                                    type="number"
                                                    value={editForm.max_per_order}
                                                    onChange={e => setEditForm({ ...editForm, max_per_order: parseInt(e.target.value) })}
                                                    className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 font-bold text-sm text-gray-900"
                                                    placeholder="10"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Perks</label>
                                            <div className="space-y-2 mb-2">
                                                {editForm.perks?.map((perk, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg text-sm font-bold">
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
                                                    className="flex-1 bg-gray-50 border-gray-200 rounded-lg p-2 font-bold text-sm text-gray-900"
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
                                                    className="bg-black text-white p-2 rounded-lg hover:bg-gray-800"
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
                                                className="w-full bg-gray-50 border-gray-200 rounded-lg p-2 font-medium text-sm text-gray-900 min-h-[80px] resize-none"
                                                placeholder="Ticket description..."
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingTierId(null)} className="px-4 py-2 text-sm text-gray-500 font-bold">Cancel</button>
                                            <button onClick={() => handleUpdateTier(tier.id)} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold flex items-center gap-2">
                                                <Check className="w-4 h-4" /> Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-bold text-xl text-gray-900">{tier.name}</h3>
                                                <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                    {tier.quantity_sold} / {tier.total_quantity} Sold
                                                </span>
                                            </div>
                                            <p className="text-gray-500 text-sm max-w-md">{tier.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-gray-900 mb-2">
                                                {formatCurrency(tier.price, event.currency)}
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setEditingTierId(tier.id)
                                                        setEditForm({
                                                            name: tier.name,
                                                            price: tier.price,
                                                            total_quantity: tier.total_quantity,
                                                            max_per_order: tier.max_per_order || 10,
                                                            description: tier.description || '',
                                                            perks: tier.perks || []
                                                        })
                                                    }}
                                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTier(tier.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Progress Bar */}
                                <div className="mt-6 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-black rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${(tier.quantity_sold / tier.total_quantity) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
