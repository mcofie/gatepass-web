import React, { useState } from 'react'
import { Plus, Image as ImageIcon, Trash2, Pencil, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { EventAddon, TicketTier } from '@/types/gatepass'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { Field, Panel, PrimaryButton, SecondaryButton, Switch, inputClass, textareaClass } from '@/components/dashboard/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

interface AddonsTabProps {
    addons: EventAddon[]
    eventId: string
    organizationId: string
    currency: string
    onUpdate: () => void
    tiers: TicketTier[]
}

type AddonForm = Pick<EventAddon, 'name' | 'price' | 'is_active' | 'selection_type'> & {
    description: string
    image_url: string
    tier_id: string | null
}

const EMPTY_FORM: AddonForm = { name: '', description: '', price: 0, image_url: '', is_active: true, selection_type: 'quantity', tier_id: null }

const SELECTION_OPTIONS = [
    { id: 'quantity', label: 'Any quantity', description: 'Guests can add more than one, like drinks or parking.' },
    { id: 'toggle', label: 'One per order', description: 'A single yes or no, like a VIP upgrade.' },
] as const

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

export function AddonsTab({ addons, eventId, organizationId, currency, onUpdate, tiers }: AddonsTabProps) {
    const supabase = createClient()
    const [editing, setEditing] = useState<'new' | string | null>(null)
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [form, setForm] = useState<AddonForm>(EMPTY_FORM)

    const close = () => {
        setForm(EMPTY_FORM)
        setEditing(null)
    }

    const startEdit = (addon: EventAddon) => {
        setForm({
            name: addon.name,
            description: addon.description ?? '',
            price: addon.price,
            image_url: addon.image_url ?? '',
            is_active: addon.is_active,
            selection_type: addon.selection_type,
            tier_id: addon.tier_id ?? null,
        })
        setEditing(addon.id)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) return toast.error('Give the add-on a name')
        if (!Number.isFinite(form.price) || form.price < 0) return toast.error('Enter a price of 0 or more')

        const values = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: form.price,
            image_url: form.image_url || null,
            is_active: form.is_active,
            selection_type: form.selection_type,
            tier_id: form.tier_id || null,
        }

        setSaving(true)
        try {
            const { error } = editing === 'new'
                ? await supabase.schema('gatepass').from('event_addons').insert({ ...values, event_id: eventId, currency })
                : await supabase.schema('gatepass').from('event_addons').update(values).eq('id', editing!)
            if (error) throw error
            toast.success(editing === 'new' ? 'Add-on created' : 'Add-on saved')
            onUpdate()
            close()
        } catch (error) {
            toast.error(errorMessage(error, 'Could not save the add-on'))
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (addon: EventAddon, isActive: boolean) => {
        setBusyId(addon.id)
        try {
            const { error } = await supabase.schema('gatepass').from('event_addons').update({ is_active: isActive }).eq('id', addon.id)
            if (error) throw error
            onUpdate()
        } catch (error) {
            toast.error(errorMessage(error, 'Could not update the add-on'))
        } finally {
            setBusyId(null)
        }
    }

    const handleDelete = async (addon: EventAddon) => {
        if (!confirm(`Delete ${addon.name}? Guests who already bought it keep it.`)) return
        setBusyId(addon.id)
        try {
            const { error } = await supabase.schema('gatepass').from('event_addons').delete().eq('id', addon.id)
            if (error) throw error
            toast.success('Add-on deleted')
            onUpdate()
        } catch (error) {
            toast.error(errorMessage(error, 'Could not delete the add-on'))
        } finally {
            setBusyId(null)
        }
    }

    if (editing) {
        return (
            <form onSubmit={handleSave} className="max-w-2xl space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={close} aria-label="Back to add-ons" className="flex size-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                        <ArrowLeft className="size-4" aria-hidden="true" />
                    </button>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">{editing === 'new' ? 'New add-on' : 'Edit add-on'}</h2>
                </div>

                <Panel title="Details">
                    <div className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_112px]">
                            <div className="space-y-5">
                                <Field label="Name" htmlFor="addon-name">
                                    <input id="addon-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Parking pass" />
                                </Field>
                                <Field label={`Price (${currency})`} htmlFor="addon-price" hint="Use 0 for a free extra.">
                                    <input
                                        id="addon-price"
                                        type="number"
                                        inputMode="decimal"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={Number.isNaN(form.price) ? '' : form.price}
                                        onChange={e => setForm({ ...form, price: e.target.valueAsNumber })}
                                        className={inputClass}
                                    />
                                </Field>
                            </div>
                            <Field label="Image" optional>
                                <div className="w-28">
                                    <MediaUploader
                                        type="image"
                                        path={`${organizationId}/addons`}
                                        value={form.image_url}
                                        onChange={url => setForm({ ...form, image_url: url })}
                                        aspectRatio="square"
                                        compact
                                        label="Add image"
                                    />
                                </div>
                            </Field>
                        </div>
                        <Field label="Description" htmlFor="addon-description" optional>
                            <textarea id="addon-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={textareaClass} placeholder="What guests get" />
                        </Field>
                    </div>
                </Panel>

                <Panel title="Who can buy it">
                    <div className="space-y-5">
                        <Field label="Available with" htmlFor="addon-tier" hint="Offer it to everyone, or only with one ticket type.">
                            <select id="addon-tier" value={form.tier_id ?? ''} onChange={e => setForm({ ...form, tier_id: e.target.value || null })} className={inputClass}>
                                <option value="">All ticket types</option>
                                {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </Field>
                        <fieldset className="space-y-2">
                            <legend className="mb-2 text-sm font-medium text-gray-950 dark:text-white">How guests choose it</legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {SELECTION_OPTIONS.map(option => {
                                    const selected = form.selection_type === option.id
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => setForm({ ...form, selection_type: option.id })}
                                            className={cn(
                                                'rounded-2xl border p-4 text-left transition-colors',
                                                selected ? 'border-gray-950 bg-gray-50 dark:border-white dark:bg-white/5' : 'border-gray-200 hover:border-gray-400 dark:border-white/10 dark:hover:border-white/30',
                                            )}
                                        >
                                            <span className="block text-sm font-semibold text-gray-950 dark:text-white">{option.label}</span>
                                            <span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{option.description}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                            <div>
                                <p className="text-sm font-medium text-gray-950 dark:text-white">On sale</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Hidden add-ons don&apos;t appear at checkout.</p>
                            </div>
                            <Switch label="On sale" checked={form.is_active} onChange={checked => setForm({ ...form, is_active: checked })} />
                        </div>
                    </div>
                </Panel>

                <div className="flex flex-wrap justify-end gap-2">
                    <SecondaryButton type="button" onClick={close}>Cancel</SecondaryButton>
                    <PrimaryButton type="submit" loading={saving}>{editing === 'new' ? 'Create add-on' : 'Save changes'}</PrimaryButton>
                </div>
            </form>
        )
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Add-ons</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Extras guests can buy with their tickets, like merch, parking or upgrades.</p>
                </div>
                {addons.length > 0 && (
                    <PrimaryButton type="button" onClick={() => setEditing('new')}>
                        <Plus className="size-4" aria-hidden="true" /> New add-on
                    </PrimaryButton>
                )}
            </div>

            {addons.length === 0 ? (
                <div className="rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                    <EmptyState
                        illustration="gift"
                        title="No add-ons yet"
                        description="Sell merch, parking or upgrades alongside tickets. Guests pick them at checkout."
                        action={
                            <PrimaryButton type="button" onClick={() => setEditing('new')}>
                                <Plus className="size-4" aria-hidden="true" /> New add-on
                            </PrimaryButton>
                        }
                    />
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#0b0b0b]">
                    {addons.map(addon => {
                        const tierName = addon.tier_id ? tiers.find(t => t.id === addon.tier_id)?.name ?? 'one ticket type' : null
                        return (
                            <li key={addon.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:flex-nowrap sm:px-6', !addon.is_active && 'opacity-60')}>
                                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                                    {addon.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={addon.image_url} alt="" className="size-full object-cover" />
                                    ) : (
                                        <ImageIcon className="size-5 text-gray-400" aria-hidden="true" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-semibold text-gray-950 dark:text-white">{addon.name}</p>
                                    <p className="text-sm font-semibold tabular-nums text-gray-950 dark:text-white sm:hidden">{addon.price === 0 ? 'Free' : formatCurrency(addon.price, addon.currency)}</p>
                                    <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                                        {[
                                            addon.selection_type === 'toggle' ? 'One per order' : 'Any quantity',
                                            tierName ? `With ${tierName}` : 'All tickets',
                                            `${addon.quantity_sold || 0} sold`,
                                        ].join(' · ')}
                                    </p>
                                </div>
                                <p className="hidden text-[15px] font-semibold tabular-nums text-gray-950 dark:text-white sm:block">
                                    {addon.price === 0 ? 'Free' : formatCurrency(addon.price, addon.currency)}
                                </p>
                                <div className="flex w-full items-center justify-end gap-1 border-t border-gray-100 pt-3 dark:border-white/10 sm:w-auto sm:border-0 sm:pt-0">
                                    <Switch label={`${addon.name} on sale`} checked={addon.is_active} disabled={busyId === addon.id} onChange={checked => toggleActive(addon, checked)} />
                                    <button type="button" onClick={() => startEdit(addon)} aria-label={`Edit ${addon.name}`} className="ml-2 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/5 dark:hover:text-white">
                                        <Pencil className="size-4" aria-hidden="true" />
                                    </button>
                                    <button type="button" onClick={() => handleDelete(addon)} disabled={busyId === addon.id} aria-label={`Delete ${addon.name}`} className="flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10">
                                        <Trash2 className="size-4" aria-hidden="true" />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
