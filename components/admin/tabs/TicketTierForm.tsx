'use client'

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { PaymentPlan, TicketTier } from '@/types/gatepass'
import { Field, PrimaryButton, SecondaryButton, Switch, inputClass, textareaClass } from '@/components/dashboard/ui'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

export type TierFormValues = {
    name: string
    price: string
    total_quantity: string
    max_per_order: string
    description: string
    perks: string[]
    tags: string[]
    is_virtual: boolean
    virtual_link: string
    virtual_instructions: string
    bulk_enabled: boolean
    min_quantity: string
    discount_type: 'percentage' | 'fixed'
    discount_value: string
    allow_instalments: boolean
    num_instalments: string
    initial_percent: string
    deadline_days: string
}

/** What a save hands back: columns for ticket_tiers, plus the payment plan when instalments are on. */
export type TierSubmit = Partial<TicketTier> & { _instalmentConfig?: Partial<PaymentPlan> | null }

export function tierToForm(tier?: TicketTier): TierFormValues {
    const plan = tier?.payment_plans?.find(p => p.is_active) ?? tier?.payment_plans?.[0]
    return {
        name: tier?.name ?? '',
        price: tier ? String(tier.price) : '',
        total_quantity: tier ? String(tier.total_quantity) : '100',
        max_per_order: String(tier?.max_per_order || 10),
        description: tier?.description ?? '',
        perks: tier?.perks ?? [],
        tags: tier?.tags ?? [],
        is_virtual: tier?.is_virtual ?? false,
        virtual_link: tier?.virtual_link ?? '',
        virtual_instructions: tier?.virtual_instructions ?? '',
        bulk_enabled: !!(tier?.min_quantity && tier?.discount_value),
        min_quantity: tier?.min_quantity ? String(tier.min_quantity) : '',
        discount_type: tier?.discount_type || 'percentage',
        discount_value: tier?.discount_value ? String(tier.discount_value) : '',
        allow_instalments: tier?.allow_instalments ?? false,
        num_instalments: String(plan?.num_instalments ?? 2),
        initial_percent: String(plan?.initial_percent ?? 50),
        deadline_days: String(plan?.deadline_days ?? 7),
    }
}

function ChipInput({ id, label, hint, values, onChange, placeholder }: { id: string; label: string; hint?: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
    const [draft, setDraft] = useState('')
    const add = () => {
        const value = draft.trim()
        if (value && !values.includes(value)) onChange([...values, value])
        setDraft('')
    }
    return (
        <Field label={label} htmlFor={id} optional hint={hint}>
            {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {values.map(value => (
                        <span key={value} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1.5 text-sm text-gray-800 dark:bg-white/10 dark:text-gray-200">
                            {value}
                            <button type="button" onClick={() => onChange(values.filter(v => v !== value))} aria-label={`Remove ${value}`} className="flex size-5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white">
                                <X className="size-3" aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <input id={id} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} className={inputClass} placeholder={placeholder} />
                <button type="button" onClick={add} aria-label={`Add ${label.toLowerCase()}`} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                    <Plus className="size-4" aria-hidden="true" />
                </button>
            </div>
        </Field>
    )
}

function ToggleRow({ id, title, description, checked, onChange, children }: { id: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10">
            <div className="flex items-start justify-between gap-4 p-4">
                <div>
                    <label htmlFor={id} className="text-sm font-medium text-gray-950 dark:text-white">{title}</label>
                    <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
                </div>
                <Switch id={id} label={title} checked={checked} onChange={onChange} />
            </div>
            {checked && children && <div className="space-y-4 border-t border-gray-100 p-4 animate-in fade-in duration-200 dark:border-white/10">{children}</div>}
        </div>
    )
}

export function TicketTierForm({ idPrefix, initial, currency, eventStartsAt, submitLabel, onSubmit, onCancel }: {
    idPrefix: string
    initial: TierFormValues
    currency: string
    eventStartsAt: string
    submitLabel: string
    onSubmit: (values: TierSubmit, meta: { virtualLinkChanged: boolean }) => Promise<void>
    onCancel: () => void
}) {
    const [form, setForm] = useState(initial)
    const [saving, setSaving] = useState(false)
    const set = <K extends keyof TierFormValues>(key: K, value: TierFormValues[K]) => setForm(f => ({ ...f, [key]: value }))
    const id = (name: string) => `${idPrefix}-${name}`
    const hasExtras = initial.description || initial.perks.length || initial.tags.length

    const price = Number(form.price || 0)
    const upfront = Number(form.initial_percent)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const quantity = Math.floor(Number(form.total_quantity))
        const maxPerOrder = Math.floor(Number(form.max_per_order))
        if (!form.name.trim()) return toast.error('Give the ticket a name')
        if (!Number.isFinite(price) || price < 0) return toast.error('Enter a price of 0 or more')
        if (!Number.isFinite(quantity) || quantity < 1) return toast.error('Make at least 1 ticket available')
        if (!form.is_virtual && (!Number.isFinite(maxPerOrder) || maxPerOrder < 1)) return toast.error('Allow at least 1 ticket per order')

        let bulk: Pick<TicketTier, 'min_quantity' | 'discount_type' | 'discount_value'> = { min_quantity: null, discount_type: null, discount_value: null }
        if (form.bulk_enabled) {
            const min = Math.floor(Number(form.min_quantity))
            const value = Number(form.discount_value)
            if (!(min >= 2)) return toast.error('Group discounts start at 2 or more tickets')
            if (!(value > 0) || (form.discount_type === 'percentage' && value > 100)) return toast.error('Enter a valid group discount')
            bulk = { min_quantity: min, discount_type: form.discount_type, discount_value: value }
        }

        let plan: Partial<PaymentPlan> | null = null
        if (form.allow_instalments) {
            const payments = Math.floor(Number(form.num_instalments))
            const days = Math.floor(Number(form.deadline_days))
            if (upfront < 10 || upfront > 90) return toast.error('Upfront payment must be between 10% and 90%')
            if (payments < 2 || payments > 12) return toast.error('Plans have 2 to 12 payments')
            if (days < 1 || days > 90) return toast.error('Days between payments must be 1 to 90')
            const daysUntilEvent = Math.ceil((new Date(eventStartsAt).getTime() - Date.now()) / 86_400_000)
            if (daysUntilEvent <= 2) return toast.error('The event is too close for new payment plans')
            if ((payments - 1) * days > daysUntilEvent - 2) {
                return toast.error(`The last payment must land 2 days before the event. Use at most ${Math.floor((daysUntilEvent - 2) / (payments - 1))} days between payments, or fewer payments.`)
            }
            plan = { num_instalments: payments, initial_percent: upfront, deadline_days: days }
        }

        setSaving(true)
        try {
            await onSubmit({
                name: form.name.trim(),
                price,
                total_quantity: quantity,
                max_per_order: form.is_virtual ? 1 : maxPerOrder,
                description: form.description.trim(),
                perks: form.perks,
                tags: form.tags,
                is_virtual: form.is_virtual,
                virtual_link: form.is_virtual ? form.virtual_link.trim() || null : null,
                virtual_instructions: form.is_virtual ? form.virtual_instructions.trim() || null : null,
                allow_instalments: form.allow_instalments,
                ...bulk,
                _instalmentConfig: plan,
            }, { virtualLinkChanged: form.is_virtual && !!form.virtual_link.trim() && form.virtual_link.trim() !== initial.virtual_link.trim() })
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" htmlFor={id('name')} className="sm:col-span-2">
                    <input id={id('name')} required value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="e.g. Early bird" />
                </Field>
                <Field label="Price" htmlFor={id('price')} hint="Use 0 for a free ticket.">
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">{currency}</span>
                        <input id={id('price')} type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className={cn(inputClass, 'pl-14')} placeholder="0" />
                    </div>
                </Field>
                <Field label="Quantity" htmlFor={id('quantity')}>
                    <input id={id('quantity')} type="number" inputMode="numeric" min="1" value={form.total_quantity} onChange={e => set('total_quantity', e.target.value)} className={inputClass} />
                </Field>
                {!form.is_virtual && (
                    <Field label="Most per order" htmlFor={id('limit')}>
                        <input id={id('limit')} type="number" inputMode="numeric" min="1" value={form.max_per_order} onChange={e => set('max_per_order', e.target.value)} className={inputClass} />
                    </Field>
                )}
            </div>

            <div className="space-y-3">
                <ToggleRow id={id('virtual')} title="Online ticket" description="For livestreams. Each buyer gets one pass and the stream link." checked={form.is_virtual} onChange={v => set('is_virtual', v)}>
                    <Field label="Stream link" htmlFor={id('stream')} hint="Adding or changing it emails everyone holding this ticket.">
                        <input id={id('stream')} type="url" value={form.virtual_link} onChange={e => set('virtual_link', e.target.value)} className={inputClass} placeholder="https://youtube.com/live/…" />
                    </Field>
                    <Field label="Access notes" htmlFor={id('access')} optional>
                        <textarea id={id('access')} value={form.virtual_instructions} onChange={e => set('virtual_instructions', e.target.value)} className={textareaClass} placeholder="Passcode, when the stream opens…" />
                    </Field>
                </ToggleRow>

                <ToggleRow id={id('bulk')} title="Group discount" description="Take something off when someone buys several of this ticket." checked={form.bulk_enabled} onChange={v => set('bulk_enabled', v)}>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                        <Field label="From" htmlFor={id('min')}>
                            <div className="relative">
                                <input id={id('min')} type="number" inputMode="numeric" min="2" value={form.min_quantity} onChange={e => set('min_quantity', e.target.value)} className={cn(inputClass, 'pr-16')} placeholder="5" />
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">tickets</span>
                            </div>
                        </Field>
                        <div role="radiogroup" aria-label="Group discount type" className="inline-flex h-11 rounded-xl border border-gray-200 p-1 dark:border-white/10">
                            {([['percentage', '%'], ['fixed', currency]] as const).map(([type, label]) => (
                                <button key={type} type="button" role="radio" aria-checked={form.discount_type === type} onClick={() => set('discount_type', type)} className={cn('min-w-12 rounded-lg px-3 text-sm font-semibold transition-colors', form.discount_type === type ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white')}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Field label="Off" htmlFor={id('off')}>
                            <input id={id('off')} type="number" inputMode="decimal" min="0" step="any" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} className={inputClass} placeholder={form.discount_type === 'percentage' ? '10' : '20'} />
                        </Field>
                    </div>
                </ToggleRow>

                <ToggleRow id={id('plans')} title="Payment plans" description="Let buyers pay part now and the rest before the event." checked={form.allow_instalments} onChange={v => set('allow_instalments', v)}>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Payments" htmlFor={id('payments')}>
                            <input id={id('payments')} type="number" inputMode="numeric" min="2" max="12" value={form.num_instalments} onChange={e => set('num_instalments', e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Upfront %" htmlFor={id('upfront')}>
                            <input id={id('upfront')} type="number" inputMode="numeric" min="10" max="90" value={form.initial_percent} onChange={e => set('initial_percent', e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Days apart" htmlFor={id('days')}>
                            <input id={id('days')} type="number" inputMode="numeric" min="1" max="90" value={form.deadline_days} onChange={e => set('deadline_days', e.target.value)} className={inputClass} />
                        </Field>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {upfront}% upfront{price > 0 ? ` (${formatCurrency(price * upfront / 100, currency)})` : ''}, then {Math.max(1, Number(form.num_instalments) - 1)} more {Number(form.num_instalments) - 1 === 1 ? 'payment' : 'payments'} every {form.deadline_days} days.
                    </p>
                </ToggleRow>
            </div>

            <details className="group rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5" open={!!hasExtras}>
                <summary className="cursor-pointer list-none text-sm font-medium text-gray-950 marker:hidden dark:text-white">
                    Description, perks and tags <span className="font-normal text-gray-400">· optional</span>
                </summary>
                <div className="mt-4 space-y-5">
                    <Field label="Description" htmlFor={id('description')} optional>
                        <textarea id={id('description')} value={form.description} onChange={e => set('description', e.target.value)} className={textareaClass} placeholder="What this ticket includes" />
                    </Field>
                    <ChipInput id={id('perk')} label="Perks" hint="Shown as a list on the event page." values={form.perks} onChange={v => set('perks', v)} placeholder="e.g. Free drink on arrival" />
                    <ChipInput id={id('tag')} label="Tags" hint="Short labels like “Limited” or “Best value”." values={form.tags} onChange={v => set('tags', v)} placeholder="e.g. Limited" />
                </div>
            </details>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-5 dark:border-white/10">
                <SecondaryButton type="button" onClick={onCancel}>Cancel</SecondaryButton>
                <PrimaryButton type="submit" loading={saving}>{submitLabel}</PrimaryButton>
            </div>
        </form>
    )
}
