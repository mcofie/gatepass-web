'use client'

import React from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import type { TicketTier, Event, PaymentPlan } from '@/types/gatepass'
import { formatCurrency } from '@/utils/format'
import { Switch } from '@/components/dashboard/ui'
import { notifyAttendeesOfVirtualLink } from '@/app/actions/communications'
import { cn } from '@/lib/utils'
import { TicketTierForm, tierToForm, type TierSubmit } from './TicketTierForm'

interface TicketTierCardProps {
    tier: TicketTier
    event: Event
    currency: string
    isStaff?: boolean
    onUpdate: (tierId: string, data: TierSubmit) => Promise<boolean>
    onDelete: (tier: TicketTier) => void
    onToggleVisibility: (tierId: string, currentVisibility: boolean) => void
    isEditing: boolean
    onEditStart: () => void
    onEditCancel: () => void
}

/** One ticket type: a list row with sales progress, or the edit form in place. */
export function TicketTierCard({ tier, event, currency, isStaff, onUpdate, onDelete, onToggleVisibility, isEditing, onEditStart, onEditCancel }: TicketTierCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tier.id, disabled: isEditing || isStaff })
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: 'relative' as const }

    const visible = tier.is_visible !== false
    const sold = tier.quantity_sold || 0
    const soldOut = tier.total_quantity > 0 && sold >= tier.total_quantity
    const plan = tier.payment_plans?.find((p: PaymentPlan) => p.is_active)

    const notes = [
        tier.is_virtual && 'Online',
        !visible && 'Hidden',
        tier.allow_instalments && (plan ? `Pay in ${plan.num_instalments}` : 'Payment plans'),
        tier.min_quantity && tier.discount_value && `${tier.min_quantity}+ get ${tier.discount_type === 'percentage' ? `${tier.discount_value}%` : formatCurrency(tier.discount_value, currency)} off`,
        ...(tier.tags ?? []),
    ].filter(Boolean) as string[]

    const handleSubmit = async (values: TierSubmit, meta: { virtualLinkChanged: boolean }) => {
        const saved = await onUpdate(tier.id, values)
        if (!saved) return
        onEditCancel()
        if (meta.virtualLinkChanged && values.virtual_link) {
            toast.promise(
                notifyAttendeesOfVirtualLink({ tierId: tier.id, eventId: event.id, virtualLink: values.virtual_link, virtualInstructions: values.virtual_instructions ?? null }),
                {
                    loading: 'Sending the new stream link to ticket holders…',
                    success: res => res.success ? `Stream link sent to ${res.sentEmailCount} by email and ${res.sentSMSCount} by SMS` : `Couldn’t notify ticket holders: ${res.error}`,
                    error: 'Couldn’t notify ticket holders',
                },
            )
        }
    }

    return (
        <li ref={setNodeRef} style={style} className={cn('bg-white dark:bg-[#0b0b0b]', isDragging && 'shadow-xl')}>
            {isEditing ? (
                <div className="p-5 sm:p-7">
                    <h3 className="mb-5 text-base font-semibold text-gray-950 dark:text-white">Edit {tier.name}</h3>
                    <TicketTierForm
                        idPrefix={`tier-${tier.id}`}
                        initial={tierToForm(tier)}
                        currency={currency}
                        eventStartsAt={event.starts_at}
                        submitLabel="Save changes"
                        onSubmit={handleSubmit}
                        onCancel={onEditCancel}
                    />
                </div>
            ) : (
                <div className="flex items-center gap-3 px-3 py-4 sm:gap-4 sm:px-5">
                    {!isStaff && (
                        <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${tier.name}`} className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300">
                            <GripVertical className="size-4" aria-hidden="true" />
                        </button>
                    )}

                    <div className={cn('min-w-0 flex-1', !visible && 'opacity-60')}>
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-[15px] font-semibold text-gray-950 dark:text-white">{tier.name}</p>
                            <p className="shrink-0 text-[15px] font-semibold tabular-nums text-gray-950 dark:text-white">{tier.price === 0 ? 'Free' : formatCurrency(tier.price, currency)}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                                <div className="h-full rounded-full bg-gray-950 transition-[width] duration-500 dark:bg-white" style={{ width: `${tier.total_quantity > 0 ? Math.min(100, (sold / tier.total_quantity) * 100) : 0}%` }} />
                            </div>
                            <p className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                {soldOut ? 'Sold out' : `${sold.toLocaleString()} / ${tier.total_quantity.toLocaleString()} sold`}
                            </p>
                        </div>
                        {notes.length > 0 && <p className="mt-1.5 truncate text-xs text-gray-500 dark:text-gray-400">{notes.join(' · ')}</p>}
                    </div>

                    {!isStaff && (
                        <div className="flex shrink-0 items-center gap-1 border-l border-gray-100 pl-3 dark:border-white/10 sm:pl-4">
                            <Switch label={visible ? `Hide ${tier.name} from the event page` : `Show ${tier.name} on the event page`} checked={visible} onChange={() => onToggleVisibility(tier.id, visible)} />
                            <button type="button" onClick={onEditStart} aria-label={`Edit ${tier.name}`} className="ml-1 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/5 dark:hover:text-white">
                                <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => onDelete(tier)} aria-label={`Delete ${tier.name}`} className="flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                                <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </li>
    )
}
