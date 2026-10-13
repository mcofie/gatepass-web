import React, { useState } from 'react'
import { Plus, Ticket, X } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TicketTierCard } from './TicketTierCard'
import { toast } from 'sonner'
import { TicketTier, Event, PaymentPlan } from '@/types/gatepass'
import { createClient } from '@/utils/supabase/client'

interface TicketsTabProps {
    event: Event
    tiers: TicketTier[]
    onTiersUpdate: (tiers: TicketTier[]) => void
    isStaff?: boolean
}

export function TicketsTab({ event, tiers, onTiersUpdate, isStaff = false }: TicketsTabProps) {
    // Local UI state
    const [creatingTier, setCreatingTier] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingTierId, setEditingTierId] = useState<string | null>(null)

    const [tierForm, setTierForm] = useState<{
        name: string,
        price: number,
        total_quantity: number,
        max_per_order: number,
        description: string,
        perks: string[],
        tags: string[],
        min_quantity: number | '',
        discount_value: number | '',
        discount_type: 'percentage' | 'fixed' | '',
        is_virtual: boolean,
        virtual_link: string,
        virtual_instructions: string
    }>({
        name: '', price: 0, total_quantity: 100, max_per_order: 10, description: '', perks: [], tags: [], min_quantity: '', discount_value: '', discount_type: '', is_virtual: false, virtual_link: '', virtual_instructions: ''
    })

    const [newPerk, setNewPerk] = useState('')
    const [newTag, setNewTag] = useState('')

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const supabase = createClient()

    const fetchTiers = async () => {
        const { data } = await supabase.schema('gatepass').from('ticket_tiers').select('*, payment_plans(*)').eq('event_id', event.id).order('sort_order', { ascending: true })
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
                    currency: event.currency || 'GHS',
                    name: tierForm.name,
                    price: tierForm.price,
                    total_quantity: tierForm.total_quantity,
                    max_per_order: tierForm.is_virtual ? 1 : tierForm.max_per_order,
                    description: tierForm.description,
                    perks: tierForm.perks,
                    tags: tierForm.tags,
                    min_quantity: tierForm.min_quantity === '' ? null : tierForm.min_quantity,
                    discount_value: tierForm.discount_value === '' ? null : tierForm.discount_value,
                    discount_type: tierForm.discount_type === '' ? null : tierForm.discount_type,
                    is_virtual: tierForm.is_virtual,
                    virtual_link: tierForm.is_virtual ? (tierForm.virtual_link.trim() || null) : null,
                    virtual_instructions: tierForm.is_virtual ? (tierForm.virtual_instructions.trim() || null) : null
                })
                .select()
                .single()

            if (data) {
                // Optimistic update or refetch
                onTiersUpdate([...tiers, data])
                setTierForm({ name: '', price: 0, total_quantity: 100, max_per_order: 10, description: '', perks: [], tags: [], min_quantity: '', discount_value: '', discount_type: '', is_virtual: false, virtual_link: '', virtual_instructions: '' })
                setShowCreateForm(false)
                toast.success('Ticket tier created')
            } else {
                toast.error(error?.message)
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'An error occurred')
        } finally {
            setCreatingTier(false)
        }
    }

    const handleUpdateTier = async (tierId: string, updatedData: Partial<TicketTier> & { _instalmentConfig?: Partial<PaymentPlan> | null }) => {
        // Extract instalment config (not a DB column on ticket_tiers)
        const { _instalmentConfig, ...tierData } = updatedData

        const { data, error } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .update(tierData)
            .eq('id', tierId)
            .select()
            .single()

        if (data) {
            // Handle payment plan upsert
            if (_instalmentConfig) {
                try {
                    // Check if plan exists
                    const { data: existingPlan, error: fetchError } = await supabase
                        .schema('gatepass')
                        .from('payment_plans')
                        .select('id')
                        .eq('tier_id', tierId)
                        .maybeSingle()

                    if (fetchError) {
                        console.error('[Payment Plan] Fetch error:', fetchError)
                        toast.error(`Payment plan fetch failed: ${fetchError.message}`)
                    }

                    if (existingPlan) {
                        // Update existing plan
                        const { error: updateError } = await supabase
                            .schema('gatepass')
                            .from('payment_plans')
                            .update({
                                ..._instalmentConfig,
                                is_active: true
                            })
                            .eq('id', existingPlan.id)

                        if (updateError) {
                            console.error('[Payment Plan] Update error:', updateError)
                            toast.error(`Payment plan update failed: ${updateError.message}`)
                        }
                    } else {
                        // Create new plan
                        const { error: insertError } = await supabase
                            .schema('gatepass')
                            .from('payment_plans')
                            .insert({
                                tier_id: tierId,
                                event_id: event.id,
                                name: `${tierData.name || 'Ticket'} Instalment Plan`,
                                allow_early_completion: true,
                                forfeit_on_miss: true,
                                grace_period_hours: 48,
                                ..._instalmentConfig,
                                is_active: true
                            })

                        if (insertError) {
                            console.error('[Payment Plan] Insert error:', JSON.stringify(insertError))
                            toast.error(`Payment plan creation failed: ${insertError.message || 'Unknown error'}`)
                        } else {
                            console.log('[Payment Plan] Created successfully')
                        }
                    }
                } catch (e: unknown) {
                    console.error('[Payment Plan] Exception:', e)
                    toast.error(`Payment plan error: ${e instanceof Error ? e.message : 'Unknown error'}`)
                }
            } else if (tierData.allow_instalments === false) {
                // Deactivate existing plans if instalments are turned off
                await supabase
                    .schema('gatepass')
                    .from('payment_plans')
                    .update({ is_active: false })
                    .eq('tier_id', tierId)
            }

            // Refetch to get updated payment_plans relation
            await fetchTiers()
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

    const fieldClass = 'h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white'
    const fieldLabelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Ticket types</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tiers.length} {tiers.length === 1 ? 'type' : 'types'}{!isStaff && ' · Drag to change their order on the event page.'}</p>
                </div>
                {!isStaff && <button type="button" onClick={() => setShowCreateForm(!showCreateForm)} aria-expanded={showCreateForm} className={showCreateForm ? "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#111] dark:text-gray-300 dark:hover:bg-white/10" : "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"}>
                    {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showCreateForm ? 'Close form' : 'Add ticket type'}
                </button>}
            </div>
                {/* Create Tier Form - Hidden for Staff */}
                {!isStaff && showCreateForm && (
                    <div className="max-w-3xl rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-950 dark:text-white">New ticket type</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start with the essentials. Add details if this ticket needs them.</p>
                        </div>
                        <form onSubmit={handleAddTier} className="space-y-4">
                            <div>
                                <label htmlFor="new-ticket-name" className={fieldLabelClass}>Ticket name</label>
                                <input
                                    id="new-ticket-name"
                                    required
                                    value={tierForm.name}
                                    onChange={e => setTierForm({ ...tierForm, name: e.target.value })}
                                    className={fieldClass}
                                    placeholder="e.g. Early Bird"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-ticket-price" className={fieldLabelClass}>Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">{event.currency || 'GHS'}</span>
                                        <input
                                            id="new-ticket-price"
                                            min={0}
                                            step="0.01"
                                            type="number"
                                            value={tierForm.price}
                                            onChange={e => setTierForm({ ...tierForm, price: parseFloat(e.target.value) })}
                                            className={`${fieldClass} pl-12`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="new-ticket-quantity" className={fieldLabelClass}>Quantity available</label>
                                    <input
                                        id="new-ticket-quantity"
                                        min={1}
                                        type="number"
                                        value={tierForm.total_quantity}
                                        onChange={e => setTierForm({ ...tierForm, total_quantity: parseInt(e.target.value) })}
                                        className={fieldClass}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-ticket-limit" className={fieldLabelClass}>Limit per order</label>
                                    <input
                                        id="new-ticket-limit"
                                        min={1}
                                        type="number"
                                        disabled={tierForm.is_virtual}
                                        value={tierForm.is_virtual ? 1 : tierForm.max_per_order}
                                        onChange={e => setTierForm({ ...tierForm, max_per_order: parseInt(e.target.value) })}
                                        className={fieldClass}
                                        placeholder="10"
                                    />
                                </div>
                            </div>

                            <details className="group rounded-xl border border-gray-200 dark:border-white/10">
                                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">More ticket settings <span className="font-normal text-gray-500 dark:text-gray-400">· Access, discounts and details</span></summary>
                                <div className="space-y-5 border-t border-gray-200 px-4 py-4 dark:border-white/10">
                            {/* Virtual Ticket / Livestream Options */}
                            <div className="space-y-4">
                                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                    <input
                                        type="checkbox"
                                        checked={tierForm.is_virtual}
                                        onChange={e => setTierForm({ ...tierForm, is_virtual: e.target.checked })}
                                        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:border-white/20"
                                    />
                                    <span>Virtual or livestream ticket</span>
                                </label>

                                {tierForm.is_virtual && (
                                    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                                        <div>
                                            <label htmlFor="new-ticket-stream-url" className={fieldLabelClass}>Livestream URL</label>
                                            <input
                                                id="new-ticket-stream-url"
                                                value={tierForm.virtual_link}
                                                onChange={e => setTierForm({ ...tierForm, virtual_link: e.target.value })}
                                                className={fieldClass}
                                                placeholder="e.g. YouTube Live, Zoom link"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="new-ticket-stream-instructions" className={fieldLabelClass}>Access instructions</label>
                                            <textarea
                                                id="new-ticket-stream-instructions"
                                                value={tierForm.virtual_instructions}
                                                onChange={e => setTierForm({ ...tierForm, virtual_instructions: e.target.value })}
                                                className="min-h-20 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                placeholder="e.g. Zoom passcode, access start times..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Quantity Discount */}
                            <div className="border-t border-gray-100 dark:border-white/10 pt-4">
                                <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">Quantity discount</p>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="new-ticket-discount-min" className={fieldLabelClass}>Minimum quantity</label>
                                            <input
                                                id="new-ticket-discount-min"
                                                type="number"
                                                min={1}
                                                value={tierForm.min_quantity}
                                                onChange={e => setTierForm({ ...tierForm, min_quantity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                                className={fieldClass}
                                                placeholder="e.g. 5"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="new-ticket-discount-type" className={fieldLabelClass}>Discount type</label>
                                            <select
                                                id="new-ticket-discount-type"
                                                value={tierForm.discount_type}
                                                onChange={e => setTierForm({ ...tierForm, discount_type: e.target.value as 'percentage' | 'fixed' | '' })}
                                                className={fieldClass}
                                            >
                                                <option value="">None</option>
                                                <option value="percentage">Percentage (%)</option>
                                                <option value="fixed">Fixed Amount</option>
                                            </select>
                                        </div>
                                    </div>
                                    {tierForm.discount_type && (
                                        <div className="animate-in fade-in duration-200">
                                            <label htmlFor="new-ticket-discount-value" className={fieldLabelClass}>
                                                {tierForm.discount_type === 'percentage' ? 'Percent off' : `Amount off (${event.currency || 'GHS'})`}
                                            </label>
                                            <input
                                                id="new-ticket-discount-value"
                                                type="number"
                                                min={0.01}
                                                step="any"
                                                value={tierForm.discount_value}
                                                onChange={e => setTierForm({ ...tierForm, discount_value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                                className={fieldClass}
                                                placeholder={tierForm.discount_type === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 20'}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Perks */}
                            <div>
                                <label htmlFor="new-ticket-perk" className={fieldLabelClass}>Perks</label>
                                <div className="space-y-2 mb-2">
                                    {tierForm.perks.map((perk, i) => (
                                        <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:text-gray-300">
                                            <span>{perk}</span>
                                            <button
                                                type="button"
                                                aria-label={`Remove perk ${perk}`}
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
                                        id="new-ticket-perk"
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
                                        className={`${fieldClass} min-w-0 flex-1`}
                                        placeholder="Add a perk..."
                                    />
                                    <button
                                        type="button"
                                        aria-label="Add perk"
                                        onClick={() => {
                                            if (newPerk.trim()) {
                                                setTierForm({ ...tierForm, perks: [...tierForm.perks, newPerk.trim()] })
                                                setNewPerk('')
                                            }
                                        }}
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label htmlFor="new-ticket-tag" className={fieldLabelClass}>Tags</label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {tierForm.tags.map((tag, i) => (
                                        <div key={i} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-white/10 dark:text-gray-300">
                                            <span>{tag}</span>
                                            <button
                                                type="button"
                                                aria-label={`Remove tag ${tag}`}
                                                onClick={() => setTierForm({ ...tierForm, tags: tierForm.tags.filter((_, idx) => idx !== i) })}
                                                className="text-gray-400 transition-colors hover:text-red-500"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        id="new-ticket-tag"
                                        value={newTag}
                                        onChange={e => setNewTag(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                if (newTag.trim()) {
                                                    setTierForm({ ...tierForm, tags: [...tierForm.tags, newTag.trim()] })
                                                    setNewTag('')
                                                }
                                            }
                                        }}
                                        className={`${fieldClass} min-w-0 flex-1`}
                                        placeholder="Add a tag..."
                                    />
                                    <button
                                        type="button"
                                        aria-label="Add tag"
                                        onClick={() => {
                                            if (newTag.trim()) {
                                                setTierForm({ ...tierForm, tags: [...tierForm.tags, newTag.trim()] })
                                                setNewTag('')
                                            }
                                        }}
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="new-ticket-description" className={fieldLabelClass}>Description</label>
                                <textarea
                                    id="new-ticket-description"
                                    value={tierForm.description}
                                    onChange={e => setTierForm({ ...tierForm, description: e.target.value })}
                                    className="min-h-24 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                    placeholder="Includes access to..."
                                />
                            </div>
                                </div>
                            </details>

                            <button
                                disabled={creatingTier}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-white dark:text-black"
                            >
                                {creatingTier ? (
                                    <span className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" /> Create ticket type
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tiers List */}
                <div className="space-y-3">
                    {tiers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white px-5 py-14 text-center dark:border-white/10 dark:bg-[#0b0b0b]">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5">
                                <Ticket className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            </div>
                            <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">No ticket types yet</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                                {isStaff ? "No ticket types have been created for this event yet." : "Add a ticket type to start selling."}
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
        </div >
    )
}
