'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/utils/format'
import { Calendar, DollarSign, TrendingUp, Filter, Download } from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV } from '@/utils/export'


type Transaction = {
    id: string
    amount: number
    currency: string
    status: string
    paid_at: string
    reservation_id: string
    events?: {
        title: string
    } | null
    // In strict TS, join might return array or object depending on relationship. Usually object if single event.
}

interface FinancialStats {
    totalGross: number
    platformFees: number
    organizerNet: number
    count: number
}

interface FinanceDashboardProps {
    adminMode?: boolean
}

export function FinanceDashboard({ adminMode = false }: FinanceDashboardProps) {
    const supabase = createClient()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'all' | '30days' | '7days'>('all')

    useEffect(() => {
        fetchTransactions()
    }, [period])

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            // Get current user for filtering ONLY if not admin mode
            const { data: { user } } = await supabase.auth.getUser()

            // Base query
            let query = supabase
                .schema('gatepass')
                .from('transactions')
                .select(`
                    id, 
                    amount, 
                    currency, 
                    status, 
                    paid_at, 
                    reservation_id,
                    reservations!inner (
                        event_id,
                        events!inner (
                            title,
                            organizer_id
                        )
                    )
                `)
                .eq('status', 'success')
                .order('paid_at', { ascending: false })

            if (user && !adminMode) {
                // Explicitly filter by organizer's events
                query = query.eq('reservations.events.organizer_id', user.id)
            }

            // Apply Period Filter
            if (period === '30days') {
                const d = new Date()
                d.setDate(d.getDate() - 30)
                query = query.gte('paid_at', d.toISOString())
            } else if (period === '7days') {
                const d = new Date()
                d.setDate(d.getDate() - 7)
                query = query.gte('paid_at', d.toISOString())
            }

            const { data, error } = await query

            if (error) throw error

            // Flatten data structure
            const formatted = data.map((tx: any) => ({
                id: tx.id,
                amount: tx.amount,
                currency: tx.currency,
                status: tx.status,
                paid_at: tx.paid_at,
                reservation_id: tx.reservation_id,
                events: tx.reservations?.events
            }))

            setTransactions(formatted)
        } catch (error) {
            console.error('Error fetching transactions:', error)
            toast.error('Failed to load financial data')
        } finally {
            setLoading(false)
        }
    }

    // Calculations
    const stats: FinancialStats = transactions.reduce((acc, tx) => {
        const gross = tx.amount
        const fee = gross * 0.04 // 4% Platform Fee
        return {
            totalGross: acc.totalGross + gross,
            platformFees: acc.platformFees + fee,
            organizerNet: acc.organizerNet + (gross - fee), // Simplified logic (ignoring payment processor fees for this view if purely platform fee focus)
            count: acc.count + 1
        }
    }, { totalGross: 0, platformFees: 0, organizerNet: 0, count: 0 })

    // Group by Event
    const eventBreakdown = transactions.reduce((acc, tx) => {
        const title = tx.events?.title || 'Unknown Event'
        if (!acc[title]) {
            acc[title] = { gross: 0, fees: 0, count: 0 }
        }
        acc[title].gross += tx.amount
        acc[title].fees += (tx.amount * 0.04)
        acc[title].count += 1
        return acc
    }, {} as Record<string, { gross: number, fees: number, count: number }>)

    const handleExport = () => {
        const data = Object.entries(eventBreakdown).map(([title, d]) => ({
            Event: title,
            Transactions: d.count,
            Gross: d.gross,
            Fees: d.fees
        }))
        exportToCSV(data, 'finance_report')
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Financial Overview</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Track platform revenue and transaction volume.</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-[#111] p-1 rounded-lg border border-gray-200 dark:border-white/10 shadow-sm">
                    <button
                        onClick={() => setPeriod('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === 'all' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        All Time
                    </button>
                    <button
                        onClick={() => setPeriod('30days')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === '30days' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        Last 30 Days
                    </button>
                    <button
                        onClick={() => setPeriod('7days')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === '7days' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        7 Days
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Platform Revenue (Hero) */}
                <div className="bg-black dark:bg-[#111] text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group border dark:border-white/10">
                    <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full translate-x-12 -translate-y-12 blur-3xl group-hover:bg-white/10 transition-colors" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Platform Revenue (4%)</span>
                        </div>
                        <div className="text-4xl font-black tracking-tight">
                            {formatCurrency(stats.platformFees, 'GHS')}
                        </div>
                        <p className="text-sm text-gray-400 mt-2">
                            Total earnings from fees
                        </p>
                    </div>
                </div>

                {/* Gross Volume */}
                <div className="bg-white dark:bg-[#111] rounded-2xl p-6 border border-gray-100 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Gross Volume</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {formatCurrency(stats.totalGross, 'GHS')}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Total transaction value processed
                    </p>
                </div>

                {/* Transactions */}
                <div className="bg-white dark:bg-[#111] rounded-2xl p-6 border border-gray-100 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Transactions</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {stats.count}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Successful payments breakdown
                    </p>
                </div>
            </div>

            {/* Event Breakdown Table */}
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white">Revenue by Event</h3>
                    <button onClick={handleExport} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-3">Event Name</th>
                                <th className="px-6 py-3 text-right">Transactions</th>
                                <th className="px-6 py-3 text-right">Gross Sales</th>
                                <th className="px-6 py-3 text-right">Platform Fee (4%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                            {Object.entries(eventBreakdown).map(([title, data], i) => (
                                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{title}</td>
                                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{data.count}</td>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-bold">{formatCurrency(data.gross, 'GHS')}</td>
                                    <td className="px-6 py-4 text-right text-green-600 dark:text-green-400 font-bold bg-green-50/30 dark:bg-green-500/10">
                                        +{formatCurrency(data.fees, 'GHS')}
                                    </td>
                                </tr>
                            ))}
                            {Object.keys(eventBreakdown).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        No transactions found for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
