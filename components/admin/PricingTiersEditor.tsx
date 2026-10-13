'use client'

import React from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { savePricingTiers } from '@/app/actions/billing'
import type { PricingTier } from '@/lib/billing'

type Row = Omit<PricingTier, 'id'> & { id?: string; key: string }

const toRow = (tier: PricingTier): Row => ({ ...tier, key: tier.id })

export function PricingTiersEditor({ initialTiers }: { initialTiers: PricingTier[] }) {
    const [rows, setRows] = React.useState<Row[]>(() => initialTiers.filter(t => t.is_active).map(toRow))
    const [removed, setRemoved] = React.useState<string[]>([])
    const [saving, setSaving] = React.useState(false)

    const update = (key: string, patch: Partial<Row>) => setRows(list => list.map(r => (r.key === key ? { ...r, ...patch } : r)))

    const handleSave = async () => {
        setSaving(true)
        try {
            const ordered = [...rows].sort((a, b) => (a.max_tickets ?? Infinity) - (b.max_tickets ?? Infinity))
            await savePricingTiers(ordered.map((row, index) => ({
                id: row.id, name: row.name, description: row.description, max_tickets: row.max_tickets,
                price_minor: row.price_minor, currency: row.currency, is_active: row.is_active, sort_order: index + 1,
            })), removed)
            setRemoved([])
            toast.success('Pricing saved')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not save pricing')
        } finally {
            setSaving(false)
        }
    }

    const inputClass = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-950 dark:border-white/10 dark:bg-white/5 dark:text-white'

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#111]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold">Event plans</h2>
                    <p className="mt-1 text-sm text-gray-500">One-time fee organizers pay before publishing, chosen by the event&apos;s total ticket capacity.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setRows(list => [...list, { key: crypto.randomUUID(), name: '', description: '', max_tickets: null, price_minor: 0, currency: list[0]?.currency ?? 'GHS', sort_order: list.length + 1, is_active: true }])}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                    <Plus className="size-4" aria-hidden="true" /> Add plan
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs text-gray-500">
                        <tr>
                            <th className="pb-2 pr-3 font-medium">Name</th>
                            <th className="pb-2 pr-3 font-medium">Up to tickets</th>
                            <th className="pb-2 pr-3 font-medium">Price</th>
                            <th className="pb-2 pr-3 font-medium">Currency</th>
                            <th className="pb-2 font-medium"><span className="sr-only">Remove</span></th>
                        </tr>
                    </thead>
                    <tbody className="align-top">
                        {rows.map(row => (
                            <tr key={row.key}>
                                <td className="py-1.5 pr-3">
                                    <input aria-label="Plan name" value={row.name} onChange={e => update(row.key, { name: e.target.value })} className={inputClass} />
                                </td>
                                <td className="py-1.5 pr-3">
                                    <input
                                        aria-label="Ticket limit"
                                        type="number"
                                        min={1}
                                        placeholder="Unlimited"
                                        value={row.max_tickets ?? ''}
                                        onChange={e => update(row.key, { max_tickets: e.target.value ? Number(e.target.value) : null })}
                                        className={inputClass}
                                    />
                                </td>
                                <td className="py-1.5 pr-3">
                                    <input
                                        aria-label="Price"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={row.price_minor / 100}
                                        onChange={e => update(row.key, { price_minor: Math.round(Number(e.target.value || 0) * 100) })}
                                        className={inputClass}
                                    />
                                </td>
                                <td className="py-1.5 pr-3">
                                    <input aria-label="Currency" maxLength={3} value={row.currency} onChange={e => update(row.key, { currency: e.target.value.toUpperCase() })} className={`${inputClass} w-20 uppercase`} />
                                </td>
                                <td className="py-1.5">
                                    <button
                                        type="button"
                                        aria-label={`Remove ${row.name || 'plan'}`}
                                        onClick={() => {
                                            setRows(list => list.filter(r => r.key !== row.key))
                                            if (row.id) setRemoved(list => [...list, row.id!])
                                        }}
                                        className="flex size-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-white/10">
                <p className="text-xs text-gray-500">Leave &ldquo;Up to tickets&rdquo; empty for the top plan. A price of 0 makes a plan free. Changes apply to events that haven&apos;t paid yet.</p>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-black px-6 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Save plans
                </button>
            </div>
        </section>
    )
}
