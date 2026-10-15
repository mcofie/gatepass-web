'use client'

import React from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { savePricingTiers } from '@/app/actions/billing'
import type { PricingTier } from '@/lib/billing'
import { PRICE_CURRENCIES } from '@/lib/billing/prices'

type Row = Omit<PricingTier, 'id'> & { id?: string; key: string }

const toRow = (tier: PricingTier): Row => ({ ...tier, prices: tier.prices ?? {}, key: tier.id })
const inputClass = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm tabular-nums outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/60'

/** Plans, with a base price and fixed price points in each major currency. */
export function PricingTiersEditor({ initialTiers }: { initialTiers: PricingTier[] }) {
    const [rows, setRows] = React.useState<Row[]>(() => initialTiers.filter(t => t.is_active).map(toRow))
    const [removed, setRemoved] = React.useState<string[]>([])
    const [saving, setSaving] = React.useState(false)

    const update = (key: string, patch: Partial<Row>) => setRows(list => list.map(r => (r.key === key ? { ...r, ...patch } : r)))
    const setPrice = (row: Row, currency: string, value: string) => {
        const prices = { ...row.prices }
        if (value === '') delete prices[currency]
        else prices[currency] = Math.round(Number(value) * 100)
        update(row.key, { prices })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const ordered = [...rows].sort((a, b) => (a.max_tickets ?? Infinity) - (b.max_tickets ?? Infinity))
            await savePricingTiers(ordered.map((row, index) => ({
                id: row.id, name: row.name, description: row.description, max_tickets: row.max_tickets,
                price_minor: row.price_minor, currency: row.currency, prices: row.prices, is_active: row.is_active, sort_order: index + 1,
            })), removed)
            setRemoved([])
            toast.success('Pricing saved')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not save pricing')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/10 sm:p-7">
                <div>
                    <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Event plans</h2>
                    <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                        One-time fee organizers pay before publishing, picked by the event’s total ticket capacity. Set a clean price in each currency; organizers see the one matching their event.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setRows(list => [...list, { key: crypto.randomUUID(), name: '', description: '', max_tickets: null, price_minor: 0, currency: list[0]?.currency ?? 'GHS', prices: {}, sort_order: list.length + 1, is_active: true }])}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                    <Plus className="size-4" aria-hidden="true" /> Add plan
                </button>
            </div>

            <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {rows.map(row => {
                    const others = PRICE_CURRENCIES.filter(c => c !== row.currency.toUpperCase())
                    return (
                        <li key={row.key} className="space-y-4 p-5 sm:p-7">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_170px_auto] sm:items-end">
                                <label className="block text-xs font-medium text-gray-500">Plan
                                    <input aria-label="Plan name" value={row.name} onChange={e => update(row.key, { name: e.target.value })} className={`${inputClass} mt-1.5 font-medium`} placeholder="e.g. Standard" />
                                </label>
                                <label className="block text-xs font-medium text-gray-500">Up to tickets
                                    <input aria-label="Ticket limit" type="number" min={1} placeholder="Unlimited" value={row.max_tickets ?? ''} onChange={e => update(row.key, { max_tickets: e.target.value ? Number(e.target.value) : null })} className={`${inputClass} mt-1.5`} />
                                </label>
                                <label className="block text-xs font-medium text-gray-500">Base price
                                    <span className="mt-1.5 flex">
                                        <select aria-label="Base currency" value={row.currency} onChange={e => update(row.key, { currency: e.target.value })} className="h-10 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 px-2 text-sm dark:border-white/10 dark:bg-white/5">
                                            {PRICE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <input aria-label="Base price" type="number" min={0} step="0.01" value={row.price_minor / 100} onChange={e => update(row.key, { price_minor: Math.round(Number(e.target.value || 0) * 100) })} className={`${inputClass} rounded-l-none`} />
                                    </span>
                                </label>
                                <button
                                    type="button"
                                    aria-label={`Remove ${row.name || 'plan'}`}
                                    onClick={() => {
                                        setRows(list => list.filter(r => r.key !== row.key))
                                        if (row.id) setRemoved(list => [...list, row.id!])
                                    }}
                                    className="flex size-10 items-center justify-center justify-self-end rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>

                            {row.price_minor > 0 && (
                                <div>
                                    <p className="mb-2 text-xs font-medium text-gray-500">Price in other currencies <span className="font-normal text-gray-400">· empty uses the base price</span></p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                        {others.map(currency => (
                                            <label key={currency} className="flex items-center overflow-hidden rounded-xl border border-gray-200 focus-within:border-gray-950 dark:border-white/10 dark:focus-within:border-white/60">
                                                <span className="flex h-10 w-12 shrink-0 items-center justify-center bg-gray-50 text-xs font-semibold text-gray-500 dark:bg-white/5">{currency}</span>
                                                <input
                                                    aria-label={`${row.name} price in ${currency}`}
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={row.prices?.[currency] !== undefined ? row.prices[currency] / 100 : ''}
                                                    onChange={e => setPrice(row, currency, e.target.value)}
                                                    className="h-10 w-full min-w-0 bg-transparent px-2.5 text-sm tabular-nums outline-none dark:text-white"
                                                    placeholder="—"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 p-5 dark:border-white/10 sm:px-7">
                <p className="max-w-xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    Leave “Up to tickets” empty for the top plan. A base price of 0 makes a plan free. Fees are charged in the event’s currency when your Paystack account accepts it (<code className="text-[11px]">PLATFORM_CHARGE_CURRENCIES</code>), otherwise at the base price. Changes apply to events that haven’t paid yet.
                </p>
                <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-gray-950 px-6 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Save plans
                </button>
            </div>
        </section>
    )
}
