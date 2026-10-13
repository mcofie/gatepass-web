'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { Check, Copy, Link2, Pencil, Plus, Shuffle, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { Discount, TicketTier } from '@/types/gatepass'
import { Field, Panel, PrimaryButton, SecondaryButton, inputClass } from '@/components/dashboard/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

const DateTimePicker = dynamic(() => import('@/components/common/DateTimePicker').then(mod => mod.DateTimePicker), { ssr: false })

type Form = {
    code: string
    type: 'percentage' | 'fixed'
    value: string
    max_uses: string
    tier_id: string
    expires_at: string
    linked_utm_campaign: string
    affiliate_email: string
    affiliate_commission_percent: string
}

const EMPTY: Form = { code: '', type: 'percentage', value: '', max_uses: '', tier_id: '', expires_at: '', linked_utm_campaign: '', affiliate_email: '', affiliate_commission_percent: '10' }

const iconButton = 'flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/5 dark:hover:text-white'

function randomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), n => alphabet[n % alphabet.length]).join('')
}

function statusOf(d: Discount, now: number) {
    if (d.expires_at && new Date(d.expires_at).getTime() < now) return { label: 'Expired', dot: 'bg-gray-400' }
    if (d.max_uses && (d.used_count || 0) >= d.max_uses) return { label: 'Used up', dot: 'bg-gray-400' }
    return { label: 'Active', dot: 'bg-emerald-500' }
}

export function PromotionsTab({ eventId, eventSlug, currency, tiers }: { eventId: string; eventSlug: string; currency: string; tiers: TicketTier[] }) {
    const supabase = useMemo(() => createClient(), [])
    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [loaded, setLoaded] = useState(false)
    const [editing, setEditing] = useState<'new' | string | null>(null)
    const [form, setForm] = useState<Form>(EMPTY)
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)
    const [now] = useState(() => Date.now())

    const fetchDiscounts = useCallback(async () => {
        const { data } = await supabase.schema('gatepass').from('discounts').select('*').eq('event_id', eventId).order('created_at', { ascending: false })
        if (data) setDiscounts(data as Discount[])
        setLoaded(true)
    }, [supabase, eventId])

    useEffect(() => { fetchDiscounts() }, [fetchDiscounts])

    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }))

    const open = (discount?: Discount) => {
        setForm(discount ? {
            code: discount.code,
            type: discount.type,
            value: String(discount.value),
            max_uses: discount.max_uses ? String(discount.max_uses) : '',
            tier_id: discount.tier_id || '',
            expires_at: discount.expires_at || '',
            linked_utm_campaign: discount.linked_utm_campaign || '',
            affiliate_email: discount.affiliate_email || '',
            affiliate_commission_percent: String(discount.affiliate_commission_percent ?? 10),
        } : { ...EMPTY, code: randomCode() })
        setEditing(discount?.id ?? 'new')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const close = () => {
        setEditing(null)
        setForm(EMPTY)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = form.code.trim().toUpperCase().replace(/\s+/g, '')
        const value = Number(form.value)
        if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast.error('Codes use 3–30 letters, numbers, - or _')
        if (!Number.isFinite(value) || value <= 0) return toast.error('Enter how much the code takes off')
        if (form.type === 'percentage' && value > 100) return toast.error('A percentage can’t be more than 100')
        if (discounts.some(d => d.code === code && d.id !== editing)) return toast.error('This event already has that code')

        const values = {
            code,
            type: form.type,
            value,
            max_uses: Number(form.max_uses) > 0 ? Math.floor(Number(form.max_uses)) : null,
            tier_id: form.tier_id || null,
            expires_at: form.expires_at || null,
            linked_utm_campaign: form.linked_utm_campaign.trim() || null,
            affiliate_email: form.affiliate_email.trim() || null,
            affiliate_commission_percent: Number(form.affiliate_commission_percent) || 0,
        }

        setSaving(true)
        try {
            const { error } = editing === 'new'
                ? await supabase.schema('gatepass').from('discounts').insert({ ...values, event_id: eventId, used_count: 0 })
                : await supabase.schema('gatepass').from('discounts').update(values).eq('id', editing!)
            if (error) throw error
            toast.success(editing === 'new' ? `${code} is live` : 'Code saved')
            close()
            await fetchDiscounts()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save the code')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (discount: Discount) => {
        if (!confirm(`Delete ${discount.code}? It stops working right away.`)) return
        const { error } = await supabase.schema('gatepass').from('discounts').delete().eq('id', discount.id)
        if (error) return toast.error(error.message)
        toast.success('Code deleted')
        if (editing === discount.id) close()
        await fetchDiscounts()
    }

    const copy = (text: string, key: string, message: string) => {
        navigator.clipboard.writeText(text)
        setCopied(key)
        toast.success(message)
        setTimeout(() => setCopied(c => (c === key ? null : c)), 1500)
    }

    const offLabel = (d: Pick<Discount, 'type' | 'value'>) => d.type === 'percentage' ? `${d.value}% off` : `${formatCurrency(d.value, currency)} off`

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Promotions</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Discount codes for early birds, partners and promoters.</p>
                </div>
                {!editing && discounts.length > 0 && (
                    <PrimaryButton type="button" onClick={() => open()}><Plus className="size-4" aria-hidden="true" /> New code</PrimaryButton>
                )}
            </div>

            {editing && (
                <form onSubmit={handleSave} className="max-w-3xl">
                    <Panel
                        title={editing === 'new' ? 'New code' : `Edit ${form.code}`}
                        footer={<>
                            <SecondaryButton type="button" onClick={close}>Cancel</SecondaryButton>
                            <PrimaryButton type="submit" loading={saving}>{editing === 'new' ? 'Create code' : 'Save changes'}</PrimaryButton>
                        </>}
                    >
                        <div className="space-y-5">
                            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto_160px] sm:items-end">
                                <Field label="Code" htmlFor="discount-code">
                                    <div className="flex gap-2">
                                        <input id="discount-code" required value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} maxLength={30} className={cn(inputClass, 'font-mono uppercase tracking-wide')} placeholder="EARLYBIRD" />
                                        <button type="button" onClick={() => set('code', randomCode())} aria-label="Generate a code" title="Generate a code" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                                            <Shuffle className="size-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                </Field>
                                <div role="radiogroup" aria-label="Discount type" className="inline-flex h-11 rounded-xl border border-gray-200 p-1 dark:border-white/10">
                                    {([['percentage', '%'], ['fixed', currency]] as const).map(([type, label]) => (
                                        <button key={type} type="button" role="radio" aria-checked={form.type === type} onClick={() => set('type', type)} className={cn('min-w-12 rounded-lg px-3 text-sm font-semibold transition-colors', form.type === type ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white')}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <Field label={form.type === 'percentage' ? 'Percent off' : 'Amount off'} htmlFor="discount-value">
                                    <input id="discount-value" type="number" inputMode="decimal" required min="0" step="0.01" max={form.type === 'percentage' ? 100 : undefined} value={form.value} onChange={e => set('value', e.target.value)} className={inputClass} placeholder={form.type === 'percentage' ? '20' : '50'} />
                                </Field>
                            </div>

                            <div className="grid gap-5 border-t border-gray-100 pt-5 dark:border-white/10 sm:grid-cols-3">
                                <Field label="Works on" htmlFor="discount-tier">
                                    <select id="discount-tier" value={form.tier_id} onChange={e => set('tier_id', e.target.value)} className={inputClass}>
                                        <option value="">All ticket types</option>
                                        {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Usage limit" htmlFor="discount-limit" optional>
                                    <input id="discount-limit" type="number" inputMode="numeric" min="0" value={form.max_uses} onChange={e => set('max_uses', e.target.value)} className={inputClass} placeholder="Unlimited" />
                                </Field>
                                <Field label="Expires" optional>
                                    <DateTimePicker date={form.expires_at ? new Date(form.expires_at) : undefined} setDate={date => set('expires_at', date ? date.toISOString() : '')} minDate={new Date(now)} />
                                </Field>
                            </div>

                            <details className="group rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5" open={!!form.affiliate_email || !!form.linked_utm_campaign}>
                                <summary className="cursor-pointer list-none text-sm font-medium text-gray-950 marker:hidden dark:text-white">
                                    Promoter and tracking <span className="font-normal text-gray-400">· optional</span>
                                </summary>
                                <div className="mt-4 grid gap-5 sm:grid-cols-3">
                                    <Field label="Promoter email" htmlFor="discount-email" hint="They get an email for each sale." className="sm:col-span-2">
                                        <input id="discount-email" type="email" value={form.affiliate_email} onChange={e => set('affiliate_email', e.target.value)} className={inputClass} placeholder="promoter@example.com" />
                                    </Field>
                                    <Field label="Commission %" htmlFor="discount-commission">
                                        <input id="discount-commission" type="number" inputMode="decimal" min="0" max="100" value={form.affiliate_commission_percent} onChange={e => set('affiliate_commission_percent', e.target.value)} className={inputClass} />
                                    </Field>
                                    <Field label="Campaign key" htmlFor="discount-campaign" hint="Matches a tracking link's campaign, so sales line up in Marketing." className="sm:col-span-3">
                                        <input id="discount-campaign" value={form.linked_utm_campaign} onChange={e => set('linked_utm_campaign', e.target.value)} className={inputClass} placeholder="summer_promo" />
                                    </Field>
                                </div>
                            </details>
                        </div>
                    </Panel>
                </form>
            )}

            {discounts.length === 0 && !editing ? (
                <div className="rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                    <EmptyState
                        illustration="megaphone"
                        title={loaded ? 'No codes yet' : 'Loading codes'}
                        description={loaded ? 'Reward early birds, thank partners, or give promoters a code to share.' : undefined}
                        action={loaded ? <PrimaryButton type="button" onClick={() => open()}><Plus className="size-4" aria-hidden="true" /> New code</PrimaryButton> : undefined}
                    />
                </div>
            ) : discounts.length > 0 && (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#0b0b0b]">
                    {discounts.map(d => {
                        const status = statusOf(d, now)
                        const used = d.used_count || 0
                        const tierName = d.tier_id ? tiers.find(t => t.id === d.tier_id)?.name ?? 'One ticket type' : 'All tickets'
                        const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${eventSlug}?code=${encodeURIComponent(d.code)}`
                        return (
                            <li key={d.id} className={cn('grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center sm:px-6', editing === d.id && 'bg-gray-50 dark:bg-white/5')}>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" onClick={() => copy(d.code, `code-${d.id}`, 'Code copied')} className="group inline-flex items-center gap-1.5 rounded-lg font-mono text-[15px] font-semibold tracking-wide text-gray-950 dark:text-white" aria-label={`Copy ${d.code}`}>
                                            {d.code}
                                            {copied === `code-${d.id}` ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
                                        </button>
                                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />{status.label}</span>
                                    </div>
                                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-medium text-gray-950 dark:text-white">{offLabel(d)}</span>
                                        {' · '}{tierName}
                                        {d.expires_at && ` · until ${new Date(d.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                        {d.affiliate_email && ` · ${d.affiliate_email}`}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm tabular-nums text-gray-950 dark:text-white">
                                        {used.toLocaleString()} <span className="text-gray-500 dark:text-gray-400">{d.max_uses ? `of ${d.max_uses.toLocaleString()} used` : used === 1 ? 'use' : 'uses'}</span>
                                    </p>
                                    {d.max_uses ? (
                                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                                            <div className="h-full rounded-full bg-gray-950 dark:bg-white" style={{ width: `${Math.min(100, (used / d.max_uses) * 100)}%` }} />
                                        </div>
                                    ) : null}
                                </div>
                                <div className="-mx-1 flex items-center justify-end">
                                    <button type="button" onClick={() => copy(link, `link-${d.id}`, 'Link with code copied')} aria-label={`Copy event link with ${d.code}`} title="Copy event link with this code" className={iconButton}>
                                        {copied === `link-${d.id}` ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
                                    </button>
                                    <button type="button" onClick={() => open(d)} aria-label={`Edit ${d.code}`} className={iconButton}><Pencil className="size-4" aria-hidden="true" /></button>
                                    <button type="button" onClick={() => remove(d)} aria-label={`Delete ${d.code}`} className={cn(iconButton, 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400')}><Trash2 className="size-4" aria-hidden="true" /></button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
