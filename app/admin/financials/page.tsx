import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { subDays } from 'date-fns'
import { createAdminClient } from '@/utils/supabase/admin'
import { DashboardFilter } from '@/components/admin/DashboardFilter'
import { AdminCard, AdminEmpty, AdminHeader, AdminStats, moreCurrencies, totalsByCurrency } from '@/components/admin/AdminUI'
import { getManagedTerms } from '@/lib/payments/managed'
import { formatCurrency } from '@/utils/format'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export const dynamic = 'force-dynamic'

const RANGE_DAYS: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null }
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "GHS 1,200 · +2 currencies" from per-currency totals. */
function headline(totals: { currency: string; amount: number }[]) {
    const [top] = totals
    return { value: formatCurrency(top?.amount ?? 0, top?.currency ?? 'GHS'), more: moreCurrencies(totals.length) }
}

export default async function FinancialsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
    const { range = '30d' } = await searchParams
    const days = RANGE_DAYS[range] === undefined ? 30 : RANGE_DAYS[range]
    const since = days ? subDays(new Date(), days).toISOString() : null
    const rangeLabel = days ? `last ${days} days` : 'all time'
    // Access is checked in the admin layout; reads go across every organizer
    const db = createAdminClient().schema('gatepass')
    const after = (query: any, column: string) => (since ? query.gte(column, since) : query)

    const [terms, fees, managed, sales, held, pending] = await Promise.all([
        getManagedTerms(),
        after(db.from('platform_fee_payments').select('reference, amount_minor, currency, covered_tickets, paid_at, events(id, title), organizers(name), platform_pricing_tiers(name)').eq('status', 'paid'), 'paid_at').order('paid_at', { ascending: false }).limit(2000),
        after(db.from('payment_sessions').select('reference, amount_minor, currency, metadata, paid_at, organizers(name)').eq('provider', 'gatepass').eq('status', 'paid'), 'paid_at').order('paid_at', { ascending: false }).limit(5000),
        after(db.from('transactions').select('amount, currency').eq('status', 'success'), 'created_at').limit(20000),
        db.from('payment_reserves').select('amount_minor, currency').in('status', ['held', 'on_hold', 'failed', 'releasing']),
        db.from('platform_fee_payments').select('reference', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', new Date(new Date().getTime() - 3600_000).toISOString()),
    ])

    const feeRows: any[] = fees.data ?? []
    const managedRows: any[] = (managed.data ?? []).map((s: any) => ({ ...s, fee_minor: Number(s.metadata?.managed?.fee_minor ?? 0) }))

    const planTotals = totalsByCurrency(feeRows.map(f => ({ amount: Number(f.amount_minor) / 100, currency: f.currency })))
    const ticketFeeTotals = totalsByCurrency(managedRows.map(s => ({ amount: s.fee_minor / 100, currency: s.currency })))
    const revenueTotals = totalsByCurrency([...planTotals, ...ticketFeeTotals])
    const managedVolume = totalsByCurrency(managedRows.map(s => ({ amount: Number(s.amount_minor) / 100, currency: s.currency })))
    const salesTotals = totalsByCurrency((sales.data ?? []).map((t: any) => ({ amount: Number(t.amount) || 0, currency: t.currency })))
    const heldTotals = totalsByCurrency((held.data ?? []).map((r: any) => ({ amount: Number(r.amount_minor) / 100, currency: r.currency })))

    const revenue = headline(revenueTotals)
    const plan = headline(planTotals)
    const ticketFees = headline(ticketFeeTotals)
    const volume = headline(managedVolume)
    const allSales = headline(salesTotals)
    const holds = headline(heldTotals)

    const stats = [
        { label: 'GatePass revenue', value: revenue.value, detail: `Plan fees + ticket fees · ${rangeLabel}${revenue.more}` },
        { label: 'Event plan fees', value: plan.value, detail: `${feeRows.length.toLocaleString()} payments${plan.more}` },
        { label: 'GatePass Payments fees', value: ticketFees.value, detail: `${terms.feePercent}% of ${managedRows.length.toLocaleString()} sales${ticketFees.more}` },
        { label: 'Sold through GatePass Payments', value: volume.value, detail: `Settled to organizers${volume.more}` },
        { label: 'Held for organizers', value: holds.value, detail: `Released after their events${holds.more}` },
        { label: 'All organizer ticket sales', value: allSales.value, detail: `Every provider · ${rangeLabel}${allSales.more}` },
    ]

    return (
        <div className="space-y-8 pb-8">
            <AdminHeader
                title="Financials"
                description="What GatePass earns: one-time event plan fees from organizers on their own payment provider, and a per-ticket fee on GatePass Payments sales. Ticket money itself goes to organizers."
            >
                <DashboardFilter />
            </AdminHeader>

            <AdminStats stats={stats} />

            {(pending.count ?? 0) > 0 && (
                <Link href="/admin" className="group flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 sm:px-6">
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    <span className="flex-1">{pending.count} event fee payment{pending.count === 1 ? ' was' : 's were'} started but not completed.</span>
                    <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
            )}

            <div className="grid items-start gap-6 xl:grid-cols-2">
                <AdminCard title="Event plan payments" meta={planTotals.length ? plan.value : undefined} description="Paid by organizers before publishing, sized by ticket capacity.">
                    {feeRows.length ? (
                        <ul className="divide-y divide-gray-100 dark:divide-white/10">
                            {feeRows.slice(0, 25).map(f => (
                                <li key={f.reference}>
                                    <Link href={f.events?.id ? `/admin/events/${f.events.id}` : '/admin/events'} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-6">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-gray-950 dark:text-white">{f.events?.title ?? 'Deleted event'}</span>
                                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                                {[f.organizers?.name ?? 'Deleted organization', f.platform_pricing_tiers?.name, f.covered_tickets ? `${Number(f.covered_tickets).toLocaleString()} tickets` : null, f.paid_at ? when(f.paid_at) : null].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        <span className="text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(Number(f.amount_minor) / 100, f.currency)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : <AdminEmpty>No plan fees paid in this period.</AdminEmpty>}
                </AdminCard>

                <AdminCard title="GatePass Payments sales" meta={ticketFeeTotals.length ? `${ticketFees.value} fees` : undefined} description={`Sales through GatePass's Paystack account. GatePass keeps ${terms.feePercent}%; the rest settles to the organizer.`}>
                    {managedRows.length ? (
                        <ul className="divide-y divide-gray-100 dark:divide-white/10">
                            {managedRows.slice(0, 25).map(s => (
                                <li key={s.reference} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-gray-950 dark:text-white">{s.organizers?.name ?? 'Deleted organization'}</span>
                                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                            {formatCurrency(Number(s.amount_minor) / 100, s.currency)} sale{s.paid_at ? ` · ${when(s.paid_at)}` : ''}
                                        </span>
                                    </span>
                                    <span className="text-right">
                                        <span className="block text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(s.fee_minor / 100, s.currency)}</span>
                                        <span className="block text-[11px] text-gray-400 dark:text-gray-500">fee</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : <AdminEmpty>No GatePass Payments sales in this period.</AdminEmpty>}
                </AdminCard>
            </div>

            {revenueTotals.length > 1 && (
                <AdminCard title="Revenue by currency" description="Each currency is shown as charged; nothing is converted.">
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                        {revenueTotals.map(t => (
                            <li key={t.currency} className="flex items-center justify-between px-5 py-3.5 text-sm sm:px-6">
                                <span className="font-medium text-gray-950 dark:text-white">{t.currency}</span>
                                <span className="font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(t.amount, t.currency)}</span>
                            </li>
                        ))}
                    </ul>
                </AdminCard>
            )}

            <div className="flex flex-wrap gap-2 text-sm">
                <Link href="/admin/payouts" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 px-4 font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">Payouts and holds <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
                <Link href="/admin/reports" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 px-4 font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">Export to CSV <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
            </div>
        </div>
    )
}
