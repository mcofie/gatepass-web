'use client'

import React, { useState } from 'react'
import { Edit2, Check, Trash2, X, Eye, EyeOff, Plus, GripVertical, CalendarClock } from 'lucide-react'
import { TicketTier, Event, PaymentPlan } from '@/types/gatepass'
import { formatCurrency } from '@/utils/format'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { notifyAttendeesOfVirtualLink } from '@/app/actions/communications'

interface TicketTierCardProps {
    tier: TicketTier
    event: Event
    isStaff?: boolean
    onUpdate: (tierId: string, data: Partial<TicketTier> & { _instalmentConfig?: Partial<PaymentPlan> | null }) => Promise<void>
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
    const [editForm, setEditForm] = useState<{
        name: string
        price: number
        total_quantity: number
        max_per_order: number
        description: string
        perks: string[]
        tags: string[]
        allow_instalments: boolean
        min_quantity: number | ''
        discount_value: number | ''
        discount_type: 'percentage' | 'fixed' | ''
        is_virtual: boolean
        virtual_link: string
        virtual_instructions: string
    }>({
        name: tier.name,
        price: tier.price,
        total_quantity: tier.total_quantity,
        max_per_order: tier.max_per_order || 10,
        description: tier.description || '',
        perks: tier.perks || [],
        tags: tier.tags || [],
        allow_instalments: tier.allow_instalments || false,
        min_quantity: tier.min_quantity || '',
        discount_value: tier.discount_value || '',
        discount_type: tier.discount_type || '',
        is_virtual: tier.is_virtual || false,
        virtual_link: tier.virtual_link || '',
        virtual_instructions: tier.virtual_instructions || ''
    })
    const [editPerk, setEditPerk] = useState('')
    const [editTag, setEditTag] = useState('')
    const [instalmentConfig, setInstalmentConfig] = useState({
        num_instalments: 2,
        initial_percent: 50,
        deadline_days: 7
    })

    // Sync form with tier prop
    React.useEffect(() => {
        setEditForm({
            name: tier.name,
            price: tier.price,
            total_quantity: tier.total_quantity,
            max_per_order: tier.max_per_order || 10,
            description: tier.description || '',
            perks: tier.perks || [],
            tags: tier.tags || [],
            allow_instalments: tier.allow_instalments || false,
            min_quantity: tier.min_quantity || '',
            discount_value: tier.discount_value || '',
            discount_type: tier.discount_type || '',
            is_virtual: tier.is_virtual || false,
            virtual_link: tier.virtual_link || '',
            virtual_instructions: tier.virtual_instructions || ''
        })
        // Load plan config if exists
        if (tier.payment_plans && tier.payment_plans.length > 0) {
            const plan = tier.payment_plans[0]
            setInstalmentConfig({
                num_instalments: plan.num_instalments,
                initial_percent: plan.initial_percent,
                deadline_days: plan.deadline_days
            })
        }
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
        if (editForm.allow_instalments) {
            // Validate against database bounds constraints
            if (instalmentConfig.initial_percent < 10 || instalmentConfig.initial_percent > 90) {
                toast.error("Upfront percentage must be between 10% and 90%.")
                return
            }
            if (instalmentConfig.num_instalments < 2 || instalmentConfig.num_instalments > 12) {
                toast.error("Number of payments must be between 2 and 12.")
                return
            }
            if (instalmentConfig.deadline_days < 1 || instalmentConfig.deadline_days > 90) {
                toast.error("Days between payments must be between 1 and 90.")
                return
            }

            const planDurationDays = (instalmentConfig.num_instalments - 1) * instalmentConfig.deadline_days
            const eventDate = new Date(event.starts_at)
            const now = new Date()

            // Calculate days from now until the event
            const msUntilEvent = eventDate.getTime() - now.getTime()
            const daysUntilEvent = Math.ceil(msUntilEvent / (1000 * 60 * 60 * 24))

            // Repayment should end at least 2 days before the event
            const bufferDays = 2

            if (daysUntilEvent <= bufferDays) {
                toast.error("Event is too close to allow new instalment plans.")
                return
            }

            if (planDurationDays > daysUntilEvent - bufferDays) {
                const maxDaysBetween = Math.floor((daysUntilEvent - bufferDays) / (instalmentConfig.num_instalments - 1))
                toast.error(`Instalment plan too long. Final payment must be at least 2 days before the event. Max allowed days between payments: ${maxDaysBetween} (or reduce number of payments).`)
                return
            }
        }

        const isLinkNewlySet = !tier.virtual_link && editForm.virtual_link.trim();
        const isLinkUpdated = tier.virtual_link && editForm.virtual_link.trim() && tier.virtual_link.trim() !== editForm.virtual_link.trim();
        const shouldNotify = editForm.is_virtual && (isLinkNewlySet || isLinkUpdated);

        await onUpdate(tier.id, {
            ...editForm,
            max_per_order: editForm.is_virtual ? 1 : editForm.max_per_order,
            min_quantity: editForm.min_quantity === '' ? null : editForm.min_quantity,
            discount_value: editForm.discount_value === '' ? null : editForm.discount_value,
            discount_type: editForm.discount_type === '' ? null : editForm.discount_type,
            _instalmentConfig: editForm.allow_instalments ? instalmentConfig : null,
            virtual_link: editForm.is_virtual ? (editForm.virtual_link.trim() || null) : null,
            virtual_instructions: editForm.is_virtual ? (editForm.virtual_instructions.trim() || null) : null
        })

        if (shouldNotify) {
            toast.promise(
                notifyAttendeesOfVirtualLink({
                    tierId: tier.id,
                    eventId: event.id,
                    virtualLink: editForm.virtual_link.trim(),
                    virtualInstructions: editForm.virtual_instructions.trim() || null
                }),
                {
                    loading: 'Notifying virtual ticket holders...',
                    success: (res) => {
                        if (res.success) {
                            return `Notified ${res.sentEmailCount} attendee(s) via email and ${res.sentSMSCount} via SMS.`;
                        } else {
                            return `Failed to notify attendees: ${res.error}`;
                        }
                    },
                    error: 'Failed to notify attendees.'
                }
            )
        }

        onEditCancel()
    }

    const editInputClass = 'h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white'
    const editLabelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 dark:border-white/10 dark:bg-[#111] dark:hover:border-white/20 sm:p-5"
        >
            {isEditing ? (
                <div className="space-y-5">
                    <div>
                        <h3 className="text-base font-semibold text-gray-950 dark:text-white">Edit ticket type</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the ticket details shown at checkout.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor={`ticket-name-${tier.id}`} className={editLabelClass}>Name</label>
                            <input
                                id={`ticket-name-${tier.id}`}
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className={editInputClass}
                                placeholder="Ticket name"
                            />
                        </div>
                        <div>
                            <label htmlFor={`ticket-price-${tier.id}`} className={editLabelClass}>Price ({event.currency || 'GHS'})</label>
                            <input
                                id={`ticket-price-${tier.id}`}
                                type="number"
                                min={0}
                                step="0.01"
                                value={editForm.price}
                                onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) })}
                                className={editInputClass}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor={`ticket-quantity-${tier.id}`} className={editLabelClass}>Total quantity</label>
                            <input
                                id={`ticket-quantity-${tier.id}`}
                                type="number"
                                min={0}
                                value={editForm.total_quantity}
                                onChange={e => setEditForm({ ...editForm, total_quantity: parseInt(e.target.value) })}
                                className={editInputClass}
                                placeholder="100"
                            />
                        </div>
                        <div>
                            <label htmlFor={`ticket-limit-${tier.id}`} className={editLabelClass}>Maximum per order</label>
                            <input
                                id={`ticket-limit-${tier.id}`}
                                type="number"
                                min={1}
                                disabled={editForm.is_virtual}
                                value={editForm.is_virtual ? 1 : editForm.max_per_order}
                                onChange={e => setEditForm({ ...editForm, max_per_order: parseInt(e.target.value) })}
                                className={editInputClass}
                                placeholder="10"
                            />
                        </div>
                    </div>

                    {/* Virtual Ticket / Livestream Options */}
                    <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-white/10">
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                            <input
                                type="checkbox"
                                checked={editForm.is_virtual}
                                onChange={e => setEditForm({ ...editForm, is_virtual: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black dark:border-white/20"
                            />
                            <span>Virtual or livestream ticket</span>
                        </label>

                        {editForm.is_virtual && (
                            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                                <div>
                                    <label htmlFor={`ticket-stream-url-${tier.id}`} className={editLabelClass}>Livestream URL</label>
                                    <input
                                        id={`ticket-stream-url-${tier.id}`}
                                        value={editForm.virtual_link}
                                        onChange={e => setEditForm({ ...editForm, virtual_link: e.target.value })}
                                        className={editInputClass}
                                        placeholder="e.g. YouTube Live, Zoom link"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={`ticket-stream-instructions-${tier.id}`} className={editLabelClass}>Access instructions</label>
                                    <textarea
                                        id={`ticket-stream-instructions-${tier.id}`}
                                        value={editForm.virtual_instructions}
                                        onChange={e => setEditForm({ ...editForm, virtual_instructions: e.target.value })}
                                        className="min-h-20 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                        placeholder="e.g. Zoom passcode, access start times..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <details className="rounded-xl border border-gray-200 dark:border-white/10">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">More ticket settings <span className="font-normal text-gray-500 dark:text-gray-400">· Perks, tags, discounts and payment plans</span></summary>
                        <div className="space-y-5 border-t border-gray-100 p-4 dark:border-white/10">
                    <div>
                        <label className={editLabelClass}>Perks</label>
                        <div className="space-y-2 mb-2">
                            {editForm.perks?.map((perk: string, i: number) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:text-gray-300">
                                    <span>{perk}</span>
                                    <button
                                        type="button"
                                        aria-label={`Remove perk ${perk}`}
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
                                className={`${editInputClass} min-w-0 flex-1`}
                                placeholder="Add a perk..."
                            />
                            <button
                                type="button"
                                aria-label="Add perk"
                                onClick={() => {
                                    if (editPerk.trim()) {
                                        setEditForm({ ...editForm, perks: [...(editForm.perks || []), editPerk.trim()] })
                                        setEditPerk('')
                                    }
                                }}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className={editLabelClass}>Tags</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {editForm.tags?.map((tag: string, i: number) => (
                                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-white/10 dark:text-gray-300">
                                    <span>{tag}</span>
                                    <button
                                        type="button"
                                        aria-label={`Remove tag ${tag}`}
                                        onClick={() => setEditForm({ ...editForm, tags: editForm.tags.filter((_, idx) => idx !== i) })}
                                        className="text-gray-400 transition-colors hover:text-red-500"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={editTag}
                                onChange={e => setEditTag(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        if (editTag.trim()) {
                                            setEditForm({ ...editForm, tags: [...(editForm.tags || []), editTag.trim()] })
                                            setEditTag('')
                                        }
                                    }
                                }}
                                className={`${editInputClass} min-w-0 flex-1`}
                                placeholder="Add a tag..."
                            />
                            <button
                                type="button"
                                aria-label="Add tag"
                                onClick={() => {
                                    if (editTag.trim()) {
                                        setEditForm({ ...editForm, tags: [...(editForm.tags || []), editTag.trim()] })
                                        setEditTag('')
                                    }
                                }}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className={editLabelClass}>Description</label>
                        <textarea
                            value={editForm.description}
                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            className="min-h-24 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                            placeholder="Ticket description..."
                        />
                    </div>

                    {/* Quantity Discount Section */}
                    <div className="border-t border-gray-100 dark:border-white/10 pt-4 mt-2">
                        <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">Quantity discount</p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={editLabelClass}>Minimum quantity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={editForm.min_quantity}
                                        onChange={e => setEditForm({ ...editForm, min_quantity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                        className={editInputClass}
                                        placeholder="e.g. 5"
                                    />
                                </div>
                                <div>
                                    <label className={editLabelClass}>Discount type</label>
                                    <select
                                        value={editForm.discount_type}
                                        onChange={e => setEditForm({ ...editForm, discount_type: e.target.value as 'percentage' | 'fixed' | '' })}
                                        className={editInputClass}
                                    >
                                        <option value="">None</option>
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount</option>
                                    </select>
                                </div>
                            </div>
                            {editForm.discount_type && (
                                <div className="animate-in fade-in duration-200">
                                    <label className={editLabelClass}>
                                        {editForm.discount_type === 'percentage' ? 'Discount Percentage (%)' : `Discount Value (${event.currency || 'GHS'})`}
                                    </label>
                                    <input
                                        type="number"
                                        min={0.01}
                                        step="any"
                                        value={editForm.discount_value}
                                        onChange={e => setEditForm({ ...editForm, discount_value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                        className={editInputClass}
                                        placeholder={editForm.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 20'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Instalment Plan Section */}
                    <div className="border-t border-gray-100 dark:border-white/10 pt-4 mt-2">
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editForm.allow_instalments}
                                    onChange={e => setEditForm({ ...editForm, allow_instalments: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-amber-500 focus:ring-amber-500/20"
                                />
                                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
                                    <CalendarClock className="w-3.5 h-3.5" />
                                    Allow instalment payments
                                </span>
                            </label>
                        </div>

                        {editForm.allow_instalments && (
                            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div>
                                        <label className={editLabelClass}>Payments</label>
                                        <input
                                            type="number"
                                            min={2}
                                            max={12}
                                            value={instalmentConfig.num_instalments}
                                            onChange={e => setInstalmentConfig({ ...instalmentConfig, num_instalments: parseInt(e.target.value) || 2 })}
                                            className={editInputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={editLabelClass}>Upfront %</label>
                                        <input
                                            type="number"
                                            min={10}
                                            max={90}
                                            value={instalmentConfig.initial_percent}
                                            onChange={e => setInstalmentConfig({ ...instalmentConfig, initial_percent: parseInt(e.target.value) || 50 })}
                                            className={editInputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={editLabelClass}>Days between</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={90}
                                            value={instalmentConfig.deadline_days}
                                            onChange={e => setInstalmentConfig({ ...instalmentConfig, deadline_days: parseInt(e.target.value) || 7 })}
                                            className={editInputClass}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Buyers will pay {instalmentConfig.initial_percent}% upfront, then the rest in {instalmentConfig.num_instalments - 1} payment(s) every {instalmentConfig.deadline_days} day(s).
                                    {editForm.price > 0 && (
                                        <> First payment: <strong>{formatCurrency(editForm.price * instalmentConfig.initial_percent / 100, event.currency)}</strong></>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                        </div>
                    </details>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                        <button type="button" onClick={onEditCancel} className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 dark:border-white/10 dark:text-gray-300">Cancel</button>
                        <button type="button" onClick={handleSave} className="flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white dark:bg-white dark:text-black">
                            <Check className="w-4 h-4" /> Save
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-2">
                        {/* Drag Handle */}
                        {!isStaff && (
                            <div
                                {...attributes}
                                {...listeners}
                                className="-ml-2 cursor-grab self-start rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 active:cursor-grabbing dark:hover:bg-white/5"
                                aria-label={`Reorder ${tier.name}`}
                            >
                                <GripVertical className="h-4 w-4" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className={`text-base font-semibold leading-snug ${tier.is_visible === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-950 dark:text-white'}`}>{tier.name}</h3>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                    {tier.quantity_sold} of {tier.total_quantity} sold
                                </span>
                                {tier.is_virtual && (
                                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                        Virtual
                                    </span>
                                )}
                                {tier.is_visible === false && (
                                    <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                        <EyeOff className="w-3 h-3" /> Hidden
                                    </span>
                                )}
                                {tier.allow_instalments && (
                                    <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                        <CalendarClock className="w-3 h-3" />
                                        {tier.payment_plans && tier.payment_plans.length > 0 && tier.payment_plans.find((p: PaymentPlan) => p.is_active)
                                            ? `Pay in ${tier.payment_plans.find((p: PaymentPlan) => p.is_active)!.num_instalments} · ${tier.payment_plans.find((p: PaymentPlan) => p.is_active)!.initial_percent}% upfront`
                                            : 'Instalments'
                                        }
                                    </span>
                                )}
                                {tier.min_quantity && tier.discount_value && (
                                    <span className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                        Buy {tier.min_quantity}+ get {tier.discount_type === 'percentage' ? `${tier.discount_value}%` : formatCurrency(tier.discount_value, event.currency)} off
                                    </span>
                                )}
                                {tier.tags && tier.tags.map((tag, idx) => (
                                    <span key={idx} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            {tier.description && <p className={`mt-2 max-w-2xl text-sm ${tier.is_visible === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>{tier.description}</p>}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 pl-6 sm:flex-col sm:items-end sm:gap-1 sm:pl-0">
                        <div className={`text-lg font-semibold tracking-tight ${tier.is_visible === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-950 dark:text-white'}`}>
                            {formatCurrency(tier.price, event.currency)}
                        </div>
                        {!isStaff && (
                            <div className="flex items-center justify-end gap-1">
                                <button
                                    onClick={() => onToggleVisibility(tier.id, tier.is_visible !== false)}
                                    className={`rounded-lg p-2 transition-colors ${tier.is_visible === false
                                        ? 'hover:bg-green-50 dark:hover:bg-green-500/10 text-gray-400 hover:text-green-500'
                                        : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600'}`}
                                    title={tier.is_visible === false ? 'Show on event page' : 'Hide from event page'}
                                    aria-label={tier.is_visible === false ? `Show ${tier.name} on event page` : `Hide ${tier.name} from event page`}
                                >
                                    {tier.is_visible === false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={onEditStart}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                    aria-label={`Edit ${tier.name}`}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(tier.id)}
                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                    aria-label={`Delete ${tier.name}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {
                !isEditing && (
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                        <div
                            className="h-full bg-black dark:bg-white rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${tier.total_quantity > 0 ? Math.min(100, (tier.quantity_sold / tier.total_quantity) * 100) : 0}%` }}
                        />
                    </div>
                )
            }
        </div >
    )
}
