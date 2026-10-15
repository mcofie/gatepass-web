'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from 'next-themes'
import { formatCurrency, formatCompactNumber } from '@/utils/format'

interface DashboardChartProps {
    data: { date: string; revenue: number }[]
    currency?: string
    title?: string
    description?: string
    seriesLabel?: string
}

/** One monochrome area series in the theme's ink colour. */
export function DashboardChart({ data, currency = 'GHS', title = 'Ticket sales', description, seriesLabel = 'Sales' }: DashboardChartProps) {
    const { resolvedTheme } = useTheme()
    const ink = resolvedTheme === 'dark' ? '#ffffff' : '#0d0d0d'
    const total = data.reduce((sum, d) => sum + d.revenue, 0)
    return (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h3>
                    {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                </div>
                <p className="text-[26px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-gray-950 dark:text-white">{formatCurrency(total, currency)}</p>
            </div>
            <div className="mt-6 h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                        <defs>
                            <linearGradient id="adminArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={ink} stopOpacity={0.16} />
                                <stop offset="100%" stopColor={ink} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={ink} strokeOpacity={0.08} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8a8a8a', fontSize: 12 }} dy={8} minTickGap={24} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a8a8a', fontSize: 12 }} tickFormatter={v => formatCompactNumber(Number(v))} width={48} />
                        <Tooltip
                            cursor={{ stroke: ink, strokeOpacity: 0.2 }}
                            contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 12 }}
                            labelStyle={{ color: '#aaa' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={value => [formatCurrency(Number(value) || 0, currency), seriesLabel]}
                        />
                        <Area type="monotone" dataKey="revenue" stroke={ink} strokeWidth={2} fill="url(#adminArea)" isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}
