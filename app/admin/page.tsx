import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { format, isSameDay, subDays } from 'date-fns'
import { createAdminClient } from '@/utils/supabase/admin'
import { PlatformPulse, type PulseItem } from '@/components/admin/PlatformPulse'
import { DashboardChart } from '@/components/admin/DashboardChart'
import { DashboardFilter } from '@/components/admin/DashboardFilter'
import { getProvider } from '@/lib/integrations/providers'
import { formatCurrency } from '@/utils/format'
import { listAuthUsers } from '@/lib/admin/auth-users'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

const RANGE_DAYS: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null }

/** Sums amounts per currency and returns the largest, plus whether others exist. */
function byCurrency(rows: { amount: number; currency: string }[]) {
    const totals = new Map<string, number>()
    for (const r of rows) totals.set((r.currency || 'GHS').toUpperCase(), (totals.get((r.currency || 'GHS').toUpperCase()) ?? 0) + r.amount)
    const [currency, amount] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['GHS', 0]
    return { currency, amount, others: totals.size - (totals.size ? 1 : 0) }
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
    const { range = '30d' } = await searchParams
    const days = RANGE_DAYS[range] === undefined ? 30 : RANGE_DAYS[range]
    const since = days ? subDays(new Date(), days).toISOString() : null
    const chartDays = days ?? 30
    // Access is checked in the layout; reads go across every organizer
    const db = createAdminClient().schema('gatepass')
    const inRange = (query: any) => (since ? query.gte('created_at', since) : query)

    const now = new Date().toISOString()
    const [fees, sales, ticketsIssued, organizers, newOrganizers, users, authUsers, liveEvents, failingProviders, pendingFees, recentSales, recentEvents, recentOrganizers] = await Promise.all([
        since
            ? db.from('platform_fee_payments').select('amount_minor, currency, paid_at').eq('status', 'paid').gte('paid_at', since)
            : db.from('platform_fee_payments').select('amount_minor, currency, paid_at').eq('status', 'paid'),
        inRange(db.from('transactions').select('amount, currency, created_at').eq('status', 'success').limit(20000)),
        inRange(db.from('tickets').select('id', { count: 'exact', head: true })),
        db.from('organizers').select('id', { count: 'exact', head: true }),
        inRange(db.from('organizers').select('id', { count: 'exact', head: true })),
        db.from('profiles').select('id', { count: 'exact', head: true }),
        listAuthUsers(),
        db.from('events').select('id', { count: 'exact', head: true }).eq('is_published', true).or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${subDays(new Date(), 1).toISOString()})`),
        db.from('organizer_integrations').select('id, provider, status, status_message, organizers(id, name)').eq('category', 'payments').neq('status', 'connected').limit(8),
        db.from('platform_fee_payments').select('reference, amount_minor, currency, created_at, events(id, title), organizers(name)').eq('status', 'pending').lt('created_at', new Date(new Date().getTime() - 3600_000).toISOString()).order('created_at', { ascending: false }).limit(5),
        db.from('transactions').select('id, amount, currency, created_at, reservations(guest_name, profiles(full_name), events(title))').eq('status', 'success').order('created_at', { ascending: false }).limit(6),
        db.from('events').select('id, title, venue_name, created_at, organizers(name)').order('created_at', { ascending: false }).limit(6),
        db.from('organizers').select('id, name, created_at').order('created_at', { ascending: false }).limit(6),
    ])

    const feeTotals = byCurrency((fees.data ?? []).map((f: any) => ({ amount: Number(f.amount_minor) / 100, currency: f.currency })))
    const salesRows: { amount: number; currency: string; created_at: string }[] = (sales.data ?? []).map((t: any) => ({ amount: Number(t.amount) || 0, currency: t.currency, created_at: t.created_at }))
    const salesTotals = byCurrency(salesRows)

    const chartData = Array.from({ length: chartDays }, (_, i) => {
        const day = subDays(new Date(), chartDays - 1 - i)
        return {
            date: format(day, 'd MMM'),
            revenue: salesRows.filter(t => (t.currency || 'GHS').toUpperCase() === salesTotals.currency && isSameDay(new Date(t.created_at), day)).reduce((sum, t) => sum + t.amount, 0),
        }
    })

    const rangeLabel = days ? `Last ${days} days` : 'All time'
    const stats = [
        { label: 'GatePass revenue', value: formatCurrency(feeTotals.amount, feeTotals.currency), detail: `Event fees paid${feeTotals.others ? ` · +${feeTotals.others} currencies` : ''}` },
        { label: 'Organizer ticket sales', value: formatCurrency(salesTotals.amount, salesTotals.currency), detail: `Paid to organizers${salesTotals.others ? ` · +${salesTotals.others} currencies` : ''}` },
        { label: 'Tickets issued', value: (ticketsIssued.count ?? 0).toLocaleString(), detail: rangeLabel },
        { label: 'Live events', value: (liveEvents.count ?? 0).toLocaleString(), detail: 'Published and not over' },
        { label: 'Organizers', value: (organizers.count ?? 0).toLocaleString(), detail: `${(newOrganizers.count ?? 0).toLocaleString()} new · ${rangeLabel.toLowerCase()}` },
        { label: 'Users', value: (users.count ?? 0).toLocaleString(), detail: `${[...authUsers.values()].filter(u => !since || u.created_at >= since).length.toLocaleString()} new · ${rangeLabel.toLowerCase()}` },
    ]

    const pulse: PulseItem[] = [
        ...(recentSales.data ?? []).map((s: any) => ({
            id: s.id,
            type: 'sale' as const,
            title: `${formatCurrency(s.amount, s.currency)} · ${s.reservations?.events?.title ?? 'Ticket sale'}`,
            subtitle: s.reservations?.profiles?.full_name || s.reservations?.guest_name || 'Guest',
            timestamp: s.created_at,
        })),
        ...(recentEvents.data ?? []).map((e: any) => ({
            id: e.id,
            type: 'event' as const,
            title: `New event · ${e.title}`,
            subtitle: [e.organizers?.name, e.venue_name].filter(Boolean).join(' · '),
            timestamp: e.created_at,
        })),
        ...(recentOrganizers.data ?? []).map((o: any) => ({
            id: o.id,
            type: 'user' as const,
            title: `New organizer · ${o.name}`,
            subtitle: 'Signed up',
            timestamp: o.created_at,
        })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8)

    const attention = [
        ...(failingProviders.data ?? []).map((i: any) => ({
            key: `int-${i.id}`,
            title: `${i.organizers?.name ?? 'An organizer'}: ${getProvider('payments', i.provider)?.name ?? i.provider} ${i.status === 'error' ? 'is failing' : 'isn’t verified'}`,
            detail: i.status_message || 'Payments through this connection may not work.',
            href: i.organizers?.id ? `/admin/users?organizer=${i.organizers.id}` : '/admin/users',
        })),
        ...(pendingFees.data ?? []).map((p: any) => ({
            key: `fee-${p.reference}`,
            title: `${p.organizers?.name ?? 'An organizer'} started paying for ${p.events?.title ?? 'an event'}`,
            detail: `${formatCurrency(Number(p.amount_minor) / 100, p.currency)} event fee, not completed`,
            href: p.events?.id ? `/admin/events/${p.events.id}` : '/admin/events',
        })),
    ]

    return (
        <div className="space-y-8 pb-8">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[44px]">Overview</h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">How GatePass is doing across every organizer.</p>
                </div>
                <DashboardFilter />
            </header>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 lg:grid-cols-3">
                {stats.map(stat => (
                    <div key={stat.label} className="min-w-0 bg-white p-5 dark:bg-[#0b0b0b] sm:p-6">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</dt>
                        <dd className="mt-3 truncate text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-gray-950 dark:text-white sm:text-[30px]" title={stat.value}>{stat.value}</dd>
                        <dd className="mt-2 truncate text-xs text-gray-400 dark:text-gray-500">{stat.detail}</dd>
                    </div>
                ))}
            </dl>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                    <DashboardChart
                        data={chartData}
                        currency={salesTotals.currency}
                        title="Ticket sales"
                        description={`${salesTotals.currency} sold by organizers per day · ${days ? rangeLabel.toLowerCase() : 'last 30 days'}`}
                    />

                    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                            <h2 className="text-base font-semibold text-gray-950 dark:text-white">Needs attention</h2>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{attention.length || 'All clear'}</span>
                        </div>
                        {attention.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">No failing payment connections or stuck event fees.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-white/10">
                                {attention.map(item => (
                                    <li key={item.key}>
                                        <Link href={item.href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-6">
                                            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-gray-950 dark:text-white">{item.title}</span>
                                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{item.detail}</span>
                                            </span>
                                            <ArrowUpRight className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-950 dark:text-gray-600 dark:group-hover:text-white" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <PlatformPulse items={pulse} viewAllLink="/admin/activity" />
            </div>
        </div>
    )
}
