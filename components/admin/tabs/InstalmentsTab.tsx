import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Download, Calendar, DollarSign, User, Mail, Phone, Clock, CheckCircle2, AlertCircle, X, ChevronRight, Hash, ArrowUpRight } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import clsx from 'clsx'
import { formatCurrency } from '@/utils/format'
import { Event, PaymentPlan, InstalmentReservation } from '@/types/gatepass'

interface InstalmentsTabProps {
    event: Event
}

export function InstalmentsTab({ event }: InstalmentsTabProps) {
    const [reservations, setReservations] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(0)
    const [count, setCount] = useState(0)
    const [selectedRes, setSelectedRes] = useState<any | null>(null)
    const [payments, setPayments] = useState<any[]>([])
    const [loadingPayments, setLoadingPayments] = useState(false)
    const ITEMS_PER_PAGE = 20

    const supabase = createClient()

    const fetchInstalments = async () => {
        setLoading(true)
        const from = page * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        try {
            // Join with payment_plans to filter by event_id
            const { data, error, count: totalCount } = await supabase
                .schema('gatepass')
                .from('instalment_reservations')
                .select(`
                    *,
                    payment_plans!inner (
                        event_id,
                        name
                    )
                `, { count: 'exact' })
                .eq('payment_plans.event_id', event.id)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) throw error

            if (data) {
                setReservations(data)
                setCount(totalCount || 0)
            }
        } catch (err: any) {
            console.error('Fetch instalments error:', err)
            import('sonner').then(({ toast }) => toast.error('Failed to load instalments: ' + err.message))
        } finally {
            setLoading(false)
        }
    }

    const fetchPayments = async (resId: string) => {
        setLoadingPayments(true)
        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('instalment_payments')
                .select('*')
                .eq('instalment_reservation_id', resId)
                .order('instalment_number', { ascending: true })

            if (error) throw error
            setPayments(data || [])
        } catch (err: any) {
            console.error('Fetch payments error:', err)
        } finally {
            setLoadingPayments(false)
        }
    }

    useEffect(() => {
        fetchInstalments()
    }, [page, event.id])

    useEffect(() => {
        if (selectedRes) {
            fetchPayments(selectedRes.id)
        } else {
            setPayments([])
        }
    }, [selectedRes])

    // Filtered reservations for local search (if we don't want to re-fetch)
    const displayReservations = searchQuery
        ? reservations.filter(r => 
            r.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : reservations

    // Calculate aggregated stats
    const stats = React.useMemo(() => {
        if (!reservations.length) return { totalExpected: 0, totalPaid: 0, totalBalance: 0 }
        
        return reservations.reduce((acc, r) => {
            acc.totalExpected += (r.total_amount || 0)
            acc.totalPaid += (r.amount_paid || 0)
            acc.totalBalance += (r.total_amount - r.amount_paid)
            return acc
        }, { totalExpected: 0, totalPaid: 0, totalBalance: 0 })
    }, [reservations])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': 
            case 'paid': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
            case 'active': 
            case 'pending': return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
            case 'forfeited': 
            case 'failed': return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
            case 'overdue': return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
            default: return 'bg-gray-50 text-gray-700 dark:bg-white/10 dark:text-gray-400'
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Total Committed</span>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                        {formatCurrency(stats.totalExpected, event.currency || 'GHS')}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Across all plans</div>
                </div>

                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Total Paid</span>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                        {formatCurrency(stats.totalPaid, event.currency || 'GHS')}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Realized Revenue</div>
                </div>

                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Remaining Balance</span>
                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                        {formatCurrency(stats.totalBalance, event.currency || 'GHS')}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Settlements</div>
                </div>
            </div>

            {/* List Table Card */}
            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="px-8 py-8 border-b border-gray-100 dark:border-white/10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/10 shadow-sm">
                            <User className="w-5 h-5 text-gray-900 dark:text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">Instalment Plans</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{count} total commitments</p>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="absolute left-4 top-3 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 pr-4 py-2.5 w-full md:w-64 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 rounded-xl text-sm transition-all outline-none"
                            />
                        </div>
                        <button
                            onClick={() => {
                                const csv = generateCSV(reservations)
                                downloadCSV(csv, `${event.slug}-instalments.csv`)
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 active:scale-95 transition-all"
                        >
                            <Download className="w-4 h-4 text-gray-400" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {loading && page === 0 ? (
                    <div className="p-32 text-center text-gray-500 flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-gray-200 border-t-black dark:border-white/10 dark:border-t-white rounded-full animate-spin" />
                        <span className="font-bold animate-pulse">Loading instalment data...</span>
                    </div>
                ) : displayReservations.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] border-b border-gray-100 dark:border-white/10">
                                <tr>
                                    <th className="px-10 py-5">Customer</th>
                                    <th className="px-10 py-5">Amount</th>
                                    <th className="px-10 py-5">Progress</th>
                                    <th className="px-10 py-5">Remaining</th>
                                    <th className="px-10 py-5">Timeline</th>
                                    <th className="px-10 py-5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {displayReservations.map((r) => (
                                    <tr 
                                        key={r.id} 
                                        onClick={() => setSelectedRes(r)}
                                        className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-black text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/5">
                                                    {(r.contact_name || 'G')[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-black dark:group-hover:text-white transition-colors">{r.contact_name || 'Guest'}</span>
                                                    <span className="text-xs text-gray-400">{r.contact_email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="font-bold text-gray-900 dark:text-white text-lg tracking-tight font-mono">
                                                {formatCurrency(r.total_amount, r.currency)}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-2 min-w-[160px]">
                                                <div className="flex justify-between items-end">
                                                    <span className="font-bold text-[10px] text-emerald-500 uppercase tracking-widest">{Math.round((r.amount_paid / r.total_amount) * 100)}% PAID</span>
                                                    <span className="text-xs font-bold text-gray-400">{formatCurrency(r.amount_paid, r.currency)}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                                                        style={{ width: `${(r.amount_paid / r.total_amount) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="font-bold text-orange-600 dark:text-orange-400 text-lg tracking-tight font-mono">
                                                {formatCurrency(r.total_amount - r.amount_paid, r.currency)}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8">
                                            {r.next_instalment_due_at ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                        {new Date(r.next_instalment_due_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Next Due</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-300 font-bold italic">Settled</span>
                                            )}
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center justify-between">
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                                                    getStatusColor(r.status)
                                                )}>
                                                    {r.status}
                                                </span>
                                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-black dark:group-hover:text-white transition-all transform group-hover:translate-x-1" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-32 text-center">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-gray-100 dark:border-white/10">
                            <DollarSign className="w-10 h-10 text-gray-200 dark:text-gray-600" />
                        </div>
                        <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-2">No instalments found</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                            Instalment payment plans for this event will appear here once customers start reserving tickets.
                        </p>
                    </div>
                )}

                {count > ITEMS_PER_PAGE && (
                    <div className="px-10 py-6 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                            Showing {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, count)} of {count}
                        </span>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-30 transition-all active:scale-95 bg-white dark:bg-[#161616]"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * ITEMS_PER_PAGE >= count}
                                className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-30 transition-all active:scale-95 bg-white dark:bg-[#161616]"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedRes && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 pointer-events-none">
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300 pointer-events-auto"
                        onClick={() => setSelectedRes(null)}
                    />
                    
                    <div className="relative w-full max-w-2xl bg-white dark:bg-[#111] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 pointer-events-auto">
                        <button 
                            onClick={() => setSelectedRes(null)}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition-all z-10 active:scale-90"
                        >
                            <X className="w-5 h-5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" />
                        </button>

                        {/* Modal Header */}
                        <div className="p-8 pb-0 flex gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center text-4xl font-bold text-gray-300 dark:text-gray-700">
                                {(selectedRes.contact_name || 'G')[0]}
                            </div>
                            <div className="flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{selectedRes.contact_name || 'Guest'}</h2>
                                    <span className={clsx(
                                        "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest",
                                        getStatusColor(selectedRes.status)
                                    )}>
                                        {selectedRes.status}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
                                        <Mail className="w-3.5 h-3.5" />
                                        {selectedRes.contact_email}
                                    </div>
                                    {selectedRes.contact_phone && (
                                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
                                            <Phone className="w-3.5 h-3.5" />
                                            {selectedRes.contact_phone}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="p-6 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Commit</span>
                                    <div className="text-3xl font-black text-gray-900 dark:text-white font-mono">
                                        {formatCurrency(selectedRes.total_amount, selectedRes.currency)}
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100/50 dark:border-emerald-500/10">
                                    <span className="text-[10px] font-bold text-emerald-600/60 dark:text-emerald-400 uppercase tracking-widest block mb-1">Total Paid</span>
                                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {formatCurrency(selectedRes.amount_paid, selectedRes.currency)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-100 dark:border-white/5">Breakdown</h3>
                                {loadingPayments ? (
                                    <div className="py-12 text-center animate-pulse text-gray-400 font-medium">Fetching details...</div>
                                ) : (
                                    <div className="space-y-3">
                                        {payments.map((p) => (
                                            <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01]">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 font-bold text-xs">
                                                    #{p.instalment_number}
                                                </div>
                                                
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                                                            {formatCurrency(p.amount, p.currency)}
                                                        </span>
                                                        <span className={clsx(
                                                            "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest",
                                                            getStatusColor(p.status)
                                                        )}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(p.due_at).toLocaleDateString()}
                                                        </div>
                                                        {p.paid_at && (
                                                            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                Paid {new Date(p.paid_at).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 pt-0 flex gap-3">
                            <button 
                                onClick={() => setSelectedRes(null)}
                                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                            >
                                Back
                            </button>
                            <a 
                                href={`mailto:${selectedRes.contact_email}`}
                                className="flex-[2] py-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Mail className="w-4 h-4" />
                                Send Reminder
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
