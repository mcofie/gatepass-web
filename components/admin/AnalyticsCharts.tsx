'use client'

import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { aggregateSalesOverTime, aggregateTicketTypes } from '@/utils/analytics'
import { useTheme } from 'next-themes'

interface AnalyticsChartsProps {
    tickets: any[]
}

export default function AnalyticsCharts({ tickets }: AnalyticsChartsProps) {
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!tickets || tickets.length === 0 || !mounted) return null

    const isDark = theme === 'dark'

    // COLORS
    const gridColor = isDark ? '#333333' : '#e5e7eb'
    const textColor = isDark ? '#9ca3af' : '#6b7280'
    const tooltipBg = isDark ? '#111111' : '#ffffff'
    const tooltipText = isDark ? '#ffffff' : '#000000'
    const lineColor = isDark ? '#ffffff' : '#000000'
    const pieColors = isDark
        ? ['#ffffff', '#a3a3a3', '#525252', '#262626']
        : ['#000000', '#666666', '#999999', '#CCCCCC']

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-[300px]">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Sales Volume</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregateSalesOverTime(tickets)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} opacity={0.5} />
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
                                borderRadius: '12px',
                                border: '1px solid ' + gridColor,
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
                            strokeWidth={3}
                            dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                            activeDot={{ r: 6, fill: lineColor }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-[300px]">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Ticket Type Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={aggregateTicketTypes(tickets)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {aggregateTicketTypes(tickets).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                borderRadius: '12px',
                                border: '1px solid ' + gridColor,
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                color: tooltipText
                            }}
                            itemStyle={{ color: tooltipText }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
