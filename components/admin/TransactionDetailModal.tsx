'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, Copy, X } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { createClient } from '@/utils/supabase/client'
import { getProvider } from '@/lib/integrations/providers'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any -- transactions and reservations arrive as loosely typed joined rows */

interface TransactionDetailModalProps {
    transaction: any
    isOpen: boolean
    onClose: () => void
    /** Kept for callers; fees are charged by the organizer's own provider, so they aren't shown here */
    eventFeeBearer?: 'customer' | 'organizer'
}

type LineItem = { label: string; detail?: string; amount: number; tone?: 'muted' | 'discount' }

const STATUS: Record<string, { label: string; dot: string }> = {
    success: { label: 'Paid', dot: 'bg-emerald-500' },
    pending: { label: 'Pending', dot: 'bg-amber-500' },
    failed: { label: 'Failed', dot: 'bg-red-500' },
    refunded: { label: 'Refunded', dot: 'bg-gray-400' },
}

/** Reservation ids for an order: direct link first, then whatever the payment metadata carried. */
function reservationIdsOf(tx: any): string[] {
    const meta = tx.metadata ?? {}
    let ids = meta.reservation_ids ?? meta.metadata?.reservation_ids
    if (!ids) {
        const fields = meta.custom_fields || meta.metadata?.custom_fields
        const field = Array.isArray(fields) ? fields.find((x: any) => x.variable_name === 'reservation_ids') : null
        if (field?.value) ids = String(field.value).split(',').map((s: string) => s.trim())
    }
    if (Array.isArray(ids) && ids.length) return ids
    return tx.reservation_id ? [tx.reservation_id] : []
}

function CopyValue({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false)
    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="flex min-w-0 items-center gap-1">
                <span className={cn('truncate text-sm text-gray-950 dark:text-white', mono && 'font-mono text-[13px]')} title={value}>{value}</span>
                <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    aria-label={`Copy ${label.toLowerCase()}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white"
                >
                    {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                </button>
            </dd>
        </div>
    )
}

export function TransactionDetailModal({ transaction, isOpen, onClose }: TransactionDetailModalProps) {
    const [reservations, setReservations] = useState<any[]>([])
    const [addonNames, setAddonNames] = useState<Record<string, { name: string; price: number }>>({})
    const [loading, setLoading] = useState(true)
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        if (!isOpen || !transaction) return
        let active = true
        const load = async () => {
            setLoading(true)
            const ids = reservationIdsOf(transaction)
            const { data } = ids.length
                ? await supabase.schema('gatepass').from('reservations').select('*, ticket_tiers(*), discounts(*), profiles(full_name, email)').in('id', ids)
                : { data: null }
            const rows = data?.length ? data : transaction.reservations ? [transaction.reservations] : []

            const addonIds = [...new Set(rows.flatMap((r: any) => (r.addons && typeof r.addons === 'object' ? Object.keys(r.addons) : [])))]
            const { data: addons } = addonIds.length
                ? await supabase.schema('gatepass').from('event_addons').select('id, name, price').in('id', addonIds)
                : { data: null }

            if (!active) return
            setReservations(rows)
            setAddonNames(Object.fromEntries((addons ?? []).map(a => [a.id, { name: a.name, price: a.price }])))
            setLoading(false)
        }
        load()
        return () => { active = false }
    }, [isOpen, transaction, supabase])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    if (!isOpen || !transaction) return null

    const currency = transaction.currency || 'GHS'
    const meta = transaction.metadata ?? {}
    const isInstalment = meta.payment_type === 'instalment' || meta.metadata?.payment_type === 'instalment'
    const providerId: string | undefined = meta.provider || (transaction.reference?.startsWith('gpfree') ? 'free' : undefined)
    const provider = providerId && providerId !== 'free' ? getProvider('payments', providerId) : undefined
    const status = STATUS[transaction.status] ?? { label: transaction.status, dot: 'bg-gray-400' }

    // What was bought, from the reservations (the amount paid is the provider's figure)
    const items: LineItem[] = []
    for (const r of reservations) {
        const qty = r.quantity || 1
        const tier = r.ticket_tiers
        let subtotal = (tier?.price || 0) * qty
        if (tier?.min_quantity && qty >= tier.min_quantity && tier.discount_value) {
            subtotal = tier.discount_type === 'percentage' ? subtotal * (1 - tier.discount_value / 100) : Math.max(0, subtotal - tier.discount_value)
        }
        items.push({ label: tier?.name || 'Ticket', detail: `× ${qty}`, amount: subtotal })

        const discount = Array.isArray(r.discounts) ? r.discounts[0] : r.discounts
        if (discount?.value) {
            const off = discount.type === 'percentage' ? subtotal * (discount.value / 100) : discount.value
            items.push({ label: `Promo ${discount.code ?? ''}`.trim(), detail: discount.type === 'percentage' ? `${discount.value}% off` : undefined, amount: -off, tone: 'discount' })
        }

        if (r.addons && typeof r.addons === 'object') {
            for (const [id, q] of Object.entries(r.addons as Record<string, number>)) {
                const addon = addonNames[id]
                if (addon && q > 0) items.push({ label: addon.name, detail: `× ${q}`, amount: addon.price * q, tone: 'muted' })
            }
        }
    }

    // Anything above the items is what the buyer paid on top, like processing fees passed on at checkout
    const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0)
    const extra = Number(transaction.amount) - itemsTotal
    if (!isInstalment && items.length > 0 && extra > 0.009) items.push({ label: 'Fees paid by buyer', amount: extra, tone: 'muted' })

    const buyer = reservations[0]
    const buyerName = buyer?.profiles?.full_name || buyer?.guest_name || 'Guest'
    const buyerEmail = buyer?.profiles?.email || buyer?.guest_email || meta.customer?.email || null
    const channel = transaction.channel && transaction.channel !== 'free' ? String(transaction.channel).replace(/_/g, ' ') : null

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Order details"
                className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl animate-in slide-in-from-bottom-8 duration-300 dark:bg-[#0b0b0b] sm:max-w-[460px] sm:rounded-[28px] sm:border sm:border-gray-200 sm:slide-in-from-bottom-0 sm:zoom-in-95 dark:sm:border-white/10"
            >
                <div className="overflow-y-auto p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
                                {status.label}{isInstalment ? ' · Instalment' : ''}
                            </p>
                            <p className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.05em] tabular-nums text-gray-950 dark:text-white">
                                {Number(transaction.amount) === 0 ? 'Free' : formatCurrency(transaction.amount, currency)}
                            </p>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(transaction.paid_at || transaction.created_at)}</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white">
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Buyer */}
                    <div className="mt-6 flex items-center gap-3 rounded-2xl bg-gray-50 p-3.5 dark:bg-white/5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-sm font-semibold text-white dark:bg-white dark:text-black">
                            {buyerName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-gray-950 dark:text-white">{buyerName}</p>
                            {buyerEmail && <a href={`mailto:${buyerEmail}`} className="block truncate text-sm text-gray-500 hover:underline dark:text-gray-400">{buyerEmail}</a>}
                        </div>
                    </div>

                    {/* Items */}
                    <section className="mt-6">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Order</h3>
                        {loading ? (
                            <div className="mt-3 space-y-2" aria-hidden="true">
                                <div className="h-5 animate-pulse rounded-md bg-gray-100 dark:bg-white/5" />
                                <div className="h-5 w-2/3 animate-pulse rounded-md bg-gray-100 dark:bg-white/5" />
                            </div>
                        ) : (
                            <ul className="mt-2 divide-y divide-gray-100 dark:divide-white/10">
                                {items.map((item, i) => (
                                    <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                                        <span className={cn('min-w-0', item.tone === 'discount' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-950 dark:text-white')}>
                                            {item.label}
                                            {item.detail && <span className="ml-1.5 text-gray-400">{item.detail}</span>}
                                        </span>
                                        <span className={cn('shrink-0 tabular-nums', item.tone === 'discount' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-950 dark:text-white')}>
                                            {item.amount < 0 ? `−${formatCurrency(-item.amount, currency)}` : formatCurrency(item.amount, currency)}
                                        </span>
                                    </li>
                                ))}
                                <li className="flex items-baseline justify-between gap-4 pt-3 text-[15px] font-semibold text-gray-950 dark:text-white">
                                    <span>{isInstalment ? 'This payment' : 'Total paid'}</span>
                                    <span className="tabular-nums">{formatCurrency(transaction.amount, currency)}</span>
                                </li>
                            </ul>
                        )}
                    </section>

                    {/* Payment */}
                    <section className="mt-6">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Payment</h3>
                        <dl className="mt-1 divide-y divide-gray-100 dark:divide-white/10">
                            <div className="flex items-center justify-between gap-3 py-3">
                                <dt className="text-sm text-gray-500 dark:text-gray-400">Paid with</dt>
                                <dd className="flex items-center gap-2 text-sm font-medium text-gray-950 dark:text-white">
                                    {provider && <Image src={`/brands/${provider.id}.png`} alt="" width={20} height={20} className="size-5 rounded-md bg-white object-contain" />}
                                    {providerId === 'free' ? 'No payment needed' : provider?.name ?? 'Payment provider'}
                                    {channel && <span className="capitalize text-gray-400">· {channel}</span>}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3 py-3">
                                <dt className="text-sm text-gray-500 dark:text-gray-400">GatePass fee</dt>
                                <dd className="text-sm font-medium text-gray-950 dark:text-white">None per ticket</dd>
                            </div>
                            {transaction.reference && <CopyValue label="Reference" value={transaction.reference} />}
                            {meta.provider_reference && meta.provider_reference !== transaction.reference && <CopyValue label="Provider ref." value={String(meta.provider_reference)} />}
                        </dl>
                        {provider && (
                            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                The money went straight to your {provider.name} account. Processing fees and refunds are handled in your {provider.name} dashboard.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
