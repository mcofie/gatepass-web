'use client'

import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { aggregateSalesOverTime, aggregateTicketTypes } from '@/utils/analytics'
import { useTheme } from 'next-themes'

interface AnalyticsChartsProps {
    tickets: any[]
}

export default function AnalyticsCharts({ tickets }: AnalyticsChartsProps) {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!tickets || tickets.length === 0 || !mounted) return null

    const isDark = resolvedTheme === 'dark'
    const salesData = aggregateSalesOverTime(tickets)
    const ticketTypes = aggregateTicketTypes(tickets)

    // COLORS
    const gridColor = isDark ? '#333333' : '#eceff2'
    const textColor = isDark ? '#9ca3af' : '#6b7280'
    const tooltipBg = isDark ? '#111111' : '#ffffff'
    const tooltipText = isDark ? '#ffffff' : '#000000'
    const lineColor = isDark ? '#ffffff' : '#000000'
    const pieColors = isDark
        ? ['#ffffff', '#b3b3b3', '#737373', '#404040']
        : ['#111111', '#5b5b5b', '#989898', '#c8c8c8']

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex h-[300px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                <h3 className="mb-5 text-sm font-semibold text-gray-950 dark:text-white">Sales over time</h3>
                <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData} margin={{ top: 8, right: 12, left: -20, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: textColor }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: textColor }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                borderRadius: '8px',
                                border: '1px solid ' + gridColor,
                                color: tooltipText
                            }}
                            itemStyle={{ color: tooltipText }}
                            labelStyle={{ color: tooltipText }}
                            cursor={{ stroke: gridColor, strokeWidth: 2 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: lineColor }}
                        />
                    </LineChart>
                </ResponsiveContainer>
                </div>
            </div>

            <div className="flex h-[380px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:h-[300px] sm:p-6">
                <h3 className="mb-5 text-sm font-semibold text-gray-950 dark:text-white">Tickets by type</h3>
                <div className="flex min-h-0 flex-1 flex-col items-center gap-3 sm:flex-row">
                <div className="h-[160px] w-full min-w-0 sm:h-full sm:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={ticketTypes}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={72}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {ticketTypes.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                borderRadius: '8px',
                                border: '1px solid ' + gridColor,
                                color: tooltipText
                            }}
                            itemStyle={{ color: tooltipText }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                </div>
                <ul className="max-h-full w-full shrink-0 space-y-2 overflow-y-auto text-xs sm:w-36">
                    {ticketTypes.map((entry, index) => (
                        <li key={entry.name} className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} aria-hidden="true" />
                            <span className="min-w-0 flex-1 break-words">{entry.name}</span>
                            <span className="font-semibold tabular-nums text-gray-950 dark:text-white">{entry.value}</span>
                        </li>
                    ))}
                </ul>
                </div>
            </div>
        </div>
    )
}
