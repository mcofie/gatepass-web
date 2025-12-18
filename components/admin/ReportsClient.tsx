'use client'

import React, { useState } from 'react'
import { FileText, Download, Calendar, Loader2, FileSpreadsheet, History } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { format } from 'date-fns'
import { DateTimePicker } from '@/components/common/DateTimePicker'

type ReportType = 'transactions' | 'users' | 'events' | 'payouts'

export function ReportsClient() {
    const [reportType, setReportType] = useState<ReportType>('transactions')
    const [startDate, setStartDate] = useState<Date | undefined>()
    const [endDate, setEndDate] = useState<Date | undefined>()
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const generateReport = async () => {
        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates.')
            return
        }

        setLoading(true)
        try {
            let data: any[] = []
            let filename = `report-${reportType}-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`

            if (reportType === 'transactions') {
                const { data: txs, error } = await supabase.schema('gatepass').from('transactions')
                    .select('*, reservations(guest_name, profiles(email, full_name), events(title))')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())

                if (error) throw error

                // transform for CSV
                data = txs?.map(t => ({
                    id: t.id,
                    amount: t.amount,
                    currency: t.currency,
                    status: t.status,
                    user: (t.reservations as any)?.profiles?.email || (t.reservations as any)?.guest_name || 'Guest',
                    event: (t.reservations as any)?.events?.title || 'Unknown',
                    date: t.created_at
                })) || []

            } else if (reportType === 'users') {
                const { data: users, error } = await supabase.schema('gatepass').from('profiles')
                    .select('*')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())

                if (error) throw error
                data = users || []
            }

            if (data.length === 0) {
                toast.warning('No data found for the selected range.')
            } else {
                downloadCSV(data, filename)
                toast.success(`Generated ${reportType} report with ${data.length} records.`)
            }

        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const downloadCSV = (data: any[], filename: string) => {
        if (!data.length) return
        const headers = Object.keys(data[0])
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName], (_, value) => value === null ? '' : value)).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Report Generator</h1>
                <p className="text-gray-500 dark:text-gray-400">Export system data to CSV for external analysis.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Generator Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-sm">

                        <div className="space-y-6">
                            {/* Report Type */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Report Type</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {['transactions', 'users', 'events', 'payouts'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setReportType(type as ReportType)}
                                            className={`p-4 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-2 ${reportType === type
                                                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-lg'
                                                : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'
                                                }`}
                                        >
                                            {type === 'transactions' && <FileSpreadsheet className="w-5 h-5" />}
                                            {type === 'users' && <FileText className="w-5 h-5" />}
                                            {type === 'events' && <Calendar className="w-5 h-5" />}
                                            {type === 'payouts' && <Download className="w-5 h-5" />}
                                            <span className="capitalize">{type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Start Date & Time</label>
                                    <DateTimePicker
                                        date={startDate}
                                        setDate={setStartDate}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">End Date & Time</label>
                                    <DateTimePicker
                                        date={endDate}
                                        setDate={setEndDate}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={generateReport}
                                disabled={loading || !startDate || !endDate}
                                className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 dark:shadow-white/5 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" /> Download CSV Report
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent Reports / History (Stateless Mockup for now) */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm h-full">
                        <div className="flex items-center gap-2 mb-6">
                            <History className="w-5 h-5 text-gray-400" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Recent Exports</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No recent export history found.</p>
                                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Your generated reports will appear here.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
