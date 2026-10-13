import React, { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { TicketTier, Event, PaymentPlan } from '@/types/gatepass'
import { createClient } from '@/utils/supabase/client'
import { Panel, PrimaryButton } from '@/components/dashboard/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/utils/format'
import { TicketTierCard } from './TicketTierCard'
import { TicketTierForm, tierToForm, type TierSubmit } from './TicketTierForm'

interface TicketsTabProps {
    event: Event
    tiers: TicketTier[]
    onTiersUpdate: (tiers: TicketTier[]) => void
    isStaff?: boolean
}

export function TicketsTab({ event, tiers, onTiersUpdate, isStaff = false }: TicketsTabProps) {
    const supabase = useMemo(() => createClient(), [])
    const [creating, setCreating] = useState(false)
    const [editingTierId, setEditingTierId] = useState<string | null>(null)
    const currency = (event.currency || tiers[0]?.currency || 'GHS').toUpperCase()

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const totals = useMemo(() => {
        const sold = tiers.reduce((sum, t) => sum + (t.quantity_sold || 0), 0)
        const capacity = tiers.reduce((sum, t) => sum + (t.total_quantity || 0), 0)
        const potential = tiers.reduce((sum, t) => sum + t.price * (t.total_quantity || 0), 0)
        return { sold, capacity, potential }
    }, [tiers])

    const fetchTiers = async () => {
        const { data } = await supabase.schema('gatepass').from('ticket_tiers').select('*, payment_plans(*)').eq('event_id', event.id).order('sort_order', { ascending: true })
        if (data) onTiersUpdate(data as TicketTier[])
    }

    /** Creates, updates or switches off the tier's payment plan to match the form. */
    const syncPlan = async (tierId: string, tierName: string, plan: Partial<PaymentPlan> | null | undefined, allowInstalments: boolean | undefined) => {
        if (plan) {
            const { data: existing } = await supabase.schema('gatepass').from('payment_plans').select('id').eq('tier_id', tierId).maybeSingle()
            const { error } = existing
                ? await supabase.schema('gatepass').from('payment_plans').update({ ...plan, is_active: true }).eq('id', existing.id)
                : await supabase.schema('gatepass').from('payment_plans').insert({
                    tier_id: tierId,
                    event_id: event.id,
                    name: `${tierName} payment plan`,
                    allow_early_completion: true,
                    forfeit_on_miss: true,
                    grace_period_hours: 48,
                    ...plan,
                    is_active: true,
                })
            if (error) toast.error(`Payment plan not saved: ${error.message}`)
        } else if (allowInstalments === false) {
            await supabase.schema('gatepass').from('payment_plans').update({ is_active: false }).eq('tier_id', tierId)
        }
    }

    const handleCreate = async (values: TierSubmit) => {
        const { _instalmentConfig, ...tierData } = values
        const { data, error } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .insert({ ...tierData, event_id: event.id, currency, sort_order: tiers.length })
            .select()
            .single()
        if (error || !data) {
            toast.error(error?.message || 'Could not create the ticket')
            return
        }
        if (_instalmentConfig) await syncPlan(data.id, data.name, _instalmentConfig, true)
        await fetchTiers()
        setCreating(false)
        toast.success(`${data.name} added`)
    }

    const handleUpdate = async (tierId: string, values: TierSubmit) => {
        const { _instalmentConfig, ...tierData } = values
        const { error } = await supabase.schema('gatepass').from('ticket_tiers').update(tierData).eq('id', tierId)
        if (error) {
            toast.error(error.message)
            return false
        }
        await syncPlan(tierId, tierData.name || 'Ticket', _instalmentConfig, tierData.allow_instalments)
        await fetchTiers()
        toast.success('Ticket saved')
        return true
    }

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return
        const next = arrayMove(tiers, tiers.findIndex(t => t.id === active.id), tiers.findIndex(t => t.id === over.id))
        onTiersUpdate(next)
        await Promise.all(next.map((tier, index) => supabase.schema('gatepass').from('ticket_tiers').update({ sort_order: index }).eq('id', tier.id)))
    }

    const handleDelete = async (tier: TicketTier) => {
        if ((tier.quantity_sold || 0) > 0) {
            toast.error(`${tier.name} has sales, so it can’t be deleted. Hide it instead.`)
            return
        }
        if (!confirm(`Delete ${tier.name}?`)) return
        const { error } = await supabase.schema('gatepass').from('ticket_tiers').delete().eq('id', tier.id)
        if (error) return toast.error(error.message)
        onTiersUpdate(tiers.filter(t => t.id !== tier.id))
        toast.success('Ticket deleted')
    }

    const handleToggleVisibility = async (tierId: string, currentlyVisible: boolean) => {
        onTiersUpdate(tiers.map(t => t.id === tierId ? { ...t, is_visible: !currentlyVisible } : t))
        const { error } = await supabase.schema('gatepass').from('ticket_tiers').update({ is_visible: !currentlyVisible }).eq('id', tierId)
        if (error) {
            onTiersUpdate(tiers)
            toast.error(error.message)
        }
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Tickets</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {tiers.length > 0
                            ? <>{totals.sold.toLocaleString()} of {totals.capacity.toLocaleString()} sold · up to {formatCurrency(totals.potential, currency)} if every ticket sells{!isStaff && tiers.length > 1 ? ' · drag to reorder' : ''}</>
                            : 'The ticket types guests can choose from.'}
                    </p>
                </div>
                {!isStaff && !creating && tiers.length > 0 && (
                    <PrimaryButton type="button" onClick={() => { setCreating(true); setEditingTierId(null) }}>
                        <Plus className="size-4" aria-hidden="true" /> New ticket
                    </PrimaryButton>
                )}
            </div>

            {creating && (
                <Panel title="New ticket" className="max-w-3xl">
                    <TicketTierForm idPrefix="new-tier" initial={tierToForm()} currency={currency} eventStartsAt={event.starts_at} submitLabel="Create ticket" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
                </Panel>
            )}

            {tiers.length === 0 ? (
                !creating && (
                    <div className="rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                        <EmptyState
                            illustration="ticket"
                            title="No tickets yet"
                            description={isStaff ? 'The organizer hasn’t added any tickets.' : 'Add at least one ticket type to start selling. Free tickets work too.'}
                            action={!isStaff ? <PrimaryButton type="button" onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden="true" /> New ticket</PrimaryButton> : undefined}
                        />
                    </div>
                )
            ) : (
                <DndContext id="ticket-tiers-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={tiers.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
                            {tiers.map(tier => (
                                <TicketTierCard
                                    key={tier.id}
                                    tier={tier}
                                    event={event}
                                    currency={currency}
                                    isStaff={isStaff}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                    onToggleVisibility={handleToggleVisibility}
                                    isEditing={editingTierId === tier.id}
                                    onEditStart={() => { setEditingTierId(tier.id); setCreating(false) }}
                                    onEditCancel={() => setEditingTierId(null)}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    )
}
