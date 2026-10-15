'use client'

import React from 'react'
import { toast } from 'sonner'
import { Check, Download, Loader2 } from 'lucide-react'
import { endOfDay, format, startOfDay, startOfMonth, startOfYear, subDays, subMonths, endOfMonth } from 'date-fns'
import { generateAdminReport, type ReportKind } from '@/app/actions/admin-reports'
import { AdminHeader } from '@/components/admin/AdminUI'

const REPORTS: { id: ReportKind; name: string; description: string }[] = [
    { id: 'sales', name: 'Ticket sales', description: 'Every payment on every provider: event, buyer, amount and channel.' },
    { id: 'plan_fees', name: 'Event plan fees', description: 'One-time fees organizers paid GatePass to publish, with the plan and tickets covered.' },
    { id: 'managed', name: 'GatePass Payments', description: 'Sales through GatePass’s Paystack account, split into fee, hold and organizer payout.' },
    { id: 'holds', name: 'Holds', description: 'Money held from new organizers, when it’s due and when it was released.' },
    { id: 'events', name: 'Events', description: 'Events created in the period, with status, tickets sold and capacity.' },
    { id: 'users', name: 'Users', description: 'Accounts created in the period, with contact details and role.' },
]

const PERIODS = [
    { id: '7d', label: 'Last 7 days', range: () => [startOfDay(subDays(new Date(), 6)), endOfDay(new Date())] },
    { id: '30d', label: 'Last 30 days', range: () => [startOfDay(subDays(new Date(), 29)), endOfDay(new Date())] },
    { id: 'month', label: 'This month', range: () => [startOfMonth(new Date()), endOfDay(new Date())] },
    { id: 'last-month', label: 'Last month', range: () => [startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1))] },
    { id: 'year', label: 'This year', range: () => [startOfYear(new Date()), endOfDay(new Date())] },
    { id: 'custom', label: 'Custom', range: null },
] as const
type PeriodId = (typeof PERIODS)[number]['id']

const dateInput = 'h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:[color-scheme:dark] dark:focus:border-white/60'

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
            <h2 className="flex items-center gap-3 text-base font-semibold text-gray-950 dark:text-white">
                <span className="flex size-7 items-center justify-center rounded-full bg-gray-950 text-xs font-semibold text-white dark:bg-white dark:text-black">{n}</span>
                {title}
            </h2>
            <div className="mt-5">{children}</div>
        </section>
    )
}

export function ReportsClient() {
    const [kind, setKind] = React.useState<ReportKind>('sales')
    const [period, setPeriod] = React.useState<PeriodId>('30d')
    const [from, setFrom] = React.useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
    const [to, setTo] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [loading, setLoading] = React.useState(false)

    const preset = PERIODS.find(p => p.id === period)!
    const [start, end] = preset.range ? preset.range() : [startOfDay(new Date(`${from}T00:00`)), endOfDay(new Date(`${to}T00:00`))]
    const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end
    const report = REPORTS.find(r => r.id === kind)!

    const download = async () => {
        if (!valid) return toast.error('Pick a start date before the end date.')
        setLoading(true)
        try {
            const { csv, count } = await generateAdminReport(kind, start.toISOString(), end.toISOString())
            if (!count) {
                toast.message(`No ${report.name.toLowerCase()} in this period.`)
                return
            }
            const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
            const link = document.createElement('a')
            link.href = url
            link.download = `gatepass-${kind.replace('_', '-')}-${format(start, 'yyyy-MM-dd')}-to-${format(end, 'yyyy-MM-dd')}.csv`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
            toast.success(`Downloaded ${count.toLocaleString()} ${count === 1 ? 'row' : 'rows'}`)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not build the report')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 pb-8">
            <AdminHeader title="Reports" description="Download platform data as CSV for accounting or analysis. Amounts are in each row’s own currency." />

            <div className="max-w-3xl space-y-4">
                <Step n={1} title="What to export">
                    <div role="radiogroup" aria-label="Report" className="grid gap-2 sm:grid-cols-2">
                        {REPORTS.map(r => {
                            const active = r.id === kind
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => setKind(r.id)}
                                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${active ? 'border-gray-950 bg-gray-50 dark:border-white dark:bg-white/5' : 'border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20'}`}
                                >
                                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-300 dark:border-white/20'}`}>
                                        {active && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
                                    </span>
                                    <span>
                                        <span className="block text-sm font-medium text-gray-950 dark:text-white">{r.name}</span>
                                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{r.description}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </Step>

                <Step n={2} title="Period">
                    <div role="radiogroup" aria-label="Period" className="flex flex-wrap gap-2">
                        {PERIODS.map(p => (
                            <button key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => setPeriod(p.id)} className={`h-9 rounded-full border px-4 text-[13px] font-medium transition-colors ${period === p.id ? 'border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {period === 'custom' && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">From
                                <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={`${dateInput} mt-1.5`} />
                            </label>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">To
                                <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={`${dateInput} mt-1.5`} />
                            </label>
                        </div>
                    )}
                </Step>

                <div className="flex flex-col gap-4 rounded-3xl bg-gray-950 p-5 text-white dark:bg-white dark:text-black sm:flex-row sm:items-center sm:justify-between sm:p-7">
                    <div className="min-w-0">
                        <p className="text-base font-semibold">{report.name}</p>
                        <p className="mt-1 text-sm text-white/60 dark:text-black/60">
                            {valid ? `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}` : 'Pick a valid period'}
                        </p>
                    </div>
                    <button type="button" onClick={download} disabled={loading || !valid} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition-opacity disabled:opacity-50 dark:bg-black dark:text-white">
                        {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" aria-hidden="true" />}
                        {loading ? 'Building…' : 'Download CSV'}
                    </button>
                </div>
            </div>
        </div>
    )
}
