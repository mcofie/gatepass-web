import React from 'react'

/** Shared building blocks for platform admin pages, matching the overview's look. */

export function AdminHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[44px]">{title}</h1>
                {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
            </div>
            {children}
        </header>
    )
}

export type AdminStat = { label: string; value: string; detail?: string }

export function AdminStats({ stats, columns = 3 }: { stats: AdminStat[]; columns?: 2 | 3 | 4 }) {
    const cols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[columns]
    return (
        <dl className={`grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 ${cols}`}>
            {stats.map(stat => (
                <div key={stat.label} className="min-w-0 bg-white p-5 dark:bg-[#0b0b0b] sm:p-6">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</dt>
                    <dd className="mt-3 truncate text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-gray-950 dark:text-white sm:text-[30px]" title={stat.value}>{stat.value}</dd>
                    {stat.detail && <dd className="mt-2 truncate text-xs text-gray-400 dark:text-gray-500">{stat.detail}</dd>}
                </div>
            ))}
        </dl>
    )
}

export function AdminCard({ title, meta, description, children, className = '' }: { title?: string; meta?: React.ReactNode; description?: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b] ${className}`}>
            {title && (
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h2>
                        {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
                    </div>
                    {meta && <div className="shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">{meta}</div>}
                </div>
            )}
            {children}
        </section>
    )
}

export function AdminEmpty({ children }: { children: React.ReactNode }) {
    return <p className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{children}</p>
}

const TONES = {
    neutral: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
    live: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    danger: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    ink: 'bg-gray-950 text-white dark:bg-white dark:text-black',
}

export function AdminPill({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
    return <span className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>
}

export function Initial({ name, src, className = 'size-9' }: { name?: string | null; src?: string | null; className?: string }) {
    return (
        <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300 ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote avatars */}
            {src ? <img src={src} alt="" className="size-full object-cover" /> : (name?.trim()?.[0] ?? '?').toUpperCase()}
        </span>
    )
}

/** Totals per currency, largest first. */
export function totalsByCurrency(rows: { amount: number; currency?: string | null }[]) {
    const totals = new Map<string, number>()
    for (const r of rows) {
        const c = (r.currency || 'GHS').toUpperCase()
        totals.set(c, (totals.get(c) ?? 0) + r.amount)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([currency, amount]) => ({ currency, amount }))
}

/** " · +2 currencies" when totals span more than one currency. */
export function moreCurrencies(count: number) {
    return count > 1 ? ` · +${count - 1} ${count === 2 ? 'currency' : 'currencies'}` : ''
}
