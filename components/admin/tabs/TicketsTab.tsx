import React, { useState } from 'react'
import { Plus, Ticket, X } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TicketTierCard } from './TicketTierCard'
import { toast } from 'sonner'
import { TicketTier, Event } from '@/types/gatepass'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/utils/format'

interface TicketsTabProps {
    event: Event
    tiers: TicketTier[]
    onTiersUpdate: (tiers: TicketTier[]) => void
    isStaff?: boolean
}

export function TicketsTab({ event, tiers, onTiersUpdate, isStaff = false }: TicketsTabProps) {
    // Local UI state
    const [creatingTier, setCreatingTier] = useState(false)
    const [editingTierId, setEditingTierId] = useState<string | null>(null)

    const [tierForm, setTierForm] = useState<{ name: string, price: number, total_quantity: number, max_per_order: number, description: string, perks: string[] }>({
        name: '', price: 0, total_quantity: 100, max_per_order: 10, description: '', perks: []
    })



    const [newPerk, setNewPerk] = useState('')

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const supabase = createClient()

    const fetchTiers = async () => {
        const { data } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', event.id).order('sort_order', { ascending: true })
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

    const handleUpdateTier = async (tierId: string, updatedData: any) => {
        const { data, error } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .update(updatedData)
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

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (active.id !== over?.id) {
            const oldIndex = tiers.findIndex((t) => t.id === active.id)
            const newIndex = tiers.findIndex((t) => t.id === over?.id)

            const newTiers = arrayMove(tiers, oldIndex, newIndex)
            onTiersUpdate(newTiers) // Optimistic update

            // Persist order
            const updates = newTiers.map((tier, index) =>
                supabase.schema('gatepass').from('ticket_tiers').update({ sort_order: index }).eq('id', tier.id)
            )
            await Promise.all(updates)
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

    const handleToggleVisibility = async (tierId: string, currentVisibility: boolean) => {
        const newVisibility = !currentVisibility
        const { data, error } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .update({ is_visible: newVisibility })
            .eq('id', tierId)
            .select()
            .single()

        if (data) {
            onTiersUpdate(tiers.map(t => t.id === tierId ? { ...t, is_visible: newVisibility } : t))
            toast.success(newVisibility ? 'Ticket tier is now visible' : 'Ticket tier is now hidden')
        } else {
            toast.error(error?.message || 'Failed to update visibility')
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`grid grid-cols-1 ${isStaff ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-8`}>
                {/* Create Tier Form - Hidden for Staff */}
                {!isStaff && (
                    <div className="md:col-span-1 border border-gray-100 dark:border-white/10 rounded-3xl p-6 bg-white dark:bg-[#111] shadow-sm h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-black dark:bg-white rounded-xl">
                                <Ticket className="w-5 h-5 text-white dark:text-black" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Create Ticket</h3>
                        </div>
                        <form onSubmit={handleAddTier} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Ticket Name</label>
                                <input
                                    value={tierForm.name}
                                    onChange={e => setTierForm({ ...tierForm, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-gray-900 dark:text-white placeholder:font-medium"
                                    placeholder="e.g. Early Bird"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase">{event.currency || 'GHS'}</span>
                                        <input
                                            type="number"
                                            value={tierForm.price}
                                            onChange={e => setTierForm({ ...tierForm, price: parseFloat(e.target.value) })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 pl-12 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-gray-900 dark:text-white"
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
                                        className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-gray-900 dark:text-white"
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
                                        className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-gray-900 dark:text-white"
                                        placeholder="10"
                                    />
                                </div>
                            </div>

                            {/* Perks */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Perks</label>
                                <div className="space-y-2 mb-2">
                                    {tierForm.perks.map((perk, i) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-2 rounded-lg text-sm font-bold dark:text-gray-300">
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
                                        className="flex-1 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold text-gray-900 dark:text-white"
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
                                        className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200"
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
                                    className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-medium text-gray-900 dark:text-white min-h-[80px] resize-none"
                                    placeholder="Includes access to..."
                                />
                            </div>

                            <button
                                disabled={creatingTier}
                                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                                {creatingTier ? (
                                    <span className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" /> Create Ticket
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tiers List */}
                <div className={isStaff ? "md:col-span-1 space-y-4" : "md:col-span-2 space-y-4"}>
                    {tiers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/10 border-dashed">
                            <div className="w-16 h-16 bg-white dark:bg-white/10 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-white/5">
                                <Ticket className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Tickets Created</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                                {isStaff ? "No ticket types have been created for this event yet." : "Create your first ticket type using the form on the left to start selling."}
                            </p>
                        </div>
                    ) : (
                        <DndContext
                            id="ticket-tiers-dnd"
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={tiers.map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {tiers.map((tier) => (
                                    <TicketTierCard
                                        key={tier.id}
                                        tier={tier}
                                        event={event}
                                        isStaff={isStaff}
                                        onUpdate={handleUpdateTier}
                                        onDelete={handleDeleteTier}
                                        onToggleVisibility={handleToggleVisibility}
                                        isEditing={editingTierId === tier.id}
                                        onEditStart={() => setEditingTierId(tier.id)}
                                        onEditCancel={() => setEditingTierId(null)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>
        </div >
    )
}
