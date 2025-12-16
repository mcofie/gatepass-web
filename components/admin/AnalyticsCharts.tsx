'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { aggregateSalesOverTime, aggregateTicketTypes } from '@/utils/analytics'

interface AnalyticsChartsProps {
    tickets: any[]
}

export default function AnalyticsCharts({ tickets }: AnalyticsChartsProps) {
    if (!tickets || tickets.length === 0) return null

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-[300px]">
                <h3 className="font-bold text-gray-900 mb-4">Sales Volume</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregateSalesOverTime(tickets)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            cursor={{ stroke: '#f3f4f6', strokeWidth: 2 }}
                        />
                        <Line type="monotone" dataKey="count" stroke="#000000" strokeWidth={3} dot={{ r: 4, fill: '#000000' }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] h-[300px]">
                <h3 className="font-bold text-gray-900 mb-4">Ticket Type Distribution</h3>
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
                        >
                            {aggregateTicketTypes(tickets).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#000000', '#666666', '#999999', '#CCCCCC'][index % 4]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
