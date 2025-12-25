'use client'

import React, { useState, useMemo } from 'react'
import { formatCurrency } from '@/utils/format'
import { calculateFees, getEffectiveFeeRates, FeeRates } from '@/utils/fees'
import { Search, Download, DollarSign, ChevronRight, X, Clock, CreditCard, History, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { exportToCSV } from '@/utils/export'
import { toast } from 'sonner'
import { approvePayout, rejectPayout } from '@/app/actions/admin/payouts'

interface PayoutsTableProps {
    events: any[]
    transactions: any[]
    payouts: any[]
    feeSettings: FeeRates
}

export function PayoutsTable({ events, transactions, payouts, feeSettings }: PayoutsTableProps) {
    const [search, setSearch] = useState('')
    const [selectedEvent, setSelectedEvent] = useState<any>(null)

    // Calculate Payouts per Event
    const eventStats = useMemo(() => {
        return events.map(event => {
            const eventTx = transactions.filter(tx => tx.reservations.event_id === event.id)

            const stats = eventTx.reduce((acc, tx) => {
                const amount = tx.amount

                // Calculate Fee Fallback
                const price = tx.reservations?.ticket_tiers?.price || 0
                const quantity = tx.reservations?.quantity || 1
                const discountObj = Array.isArray(tx.reservations?.discounts) ? tx.reservations?.discounts[0] : tx.reservations?.discounts

                let discountAmount = 0
                if (discountObj) {
                    if (discountObj.type === 'percentage') discountAmount = (price * quantity) * (discountObj.value / 100)
                    else discountAmount = discountObj.value
                }
                const subtotal = Math.max(0, (price * quantity) - discountAmount)

                const effectiveRates = getEffectiveFeeRates(feeSettings, event)
                const calculated = calculateFees(subtotal, 0, event.fee_bearer || 'customer', effectiveRates)

                // Use Snapshot if available
                const platFee = tx.platform_fee ?? calculated.platformFee
                const procFee = tx.applied_processor_fee ?? calculated.processorFee

                const net = amount - platFee - procFee

                return {
                    gross: acc.gross + amount,
                    platformFees: acc.platformFees + platFee,
                    processorFees: acc.processorFees + procFee,
                    netPayout: acc.netPayout + net,
                    count: acc.count + 1
                }
            }, { gross: 0, platformFees: 0, processorFees: 0, netPayout: 0, count: 0 })

            // Payouts Logic
            const eventPayouts = payouts.filter(p => p.event_id === event.id)
            const amountPaid = eventPayouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
            const remainingDue = stats.netPayout - amountPaid

            // Identify Active Request
            const activeRequest = eventPayouts.find(p => p.status === 'pending' || p.status === 'processing')

            return {
                ...event,
                stats: { ...stats, amountPaid, remainingDue },
                payouts: eventPayouts,
                activeRequest
            }
        }).sort((a, b) => (b.activeRequest ? 1 : 0) - (a.activeRequest ? 1 : 0) || b.stats.netPayout - a.stats.netPayout)
    }, [events, transactions, payouts, feeSettings])

    const [processingId, setProcessingId] = useState<string | null>(null)

    const handleApprove = async (payoutId: string) => {
        if (!confirm('Mark this payout as PAID? This does not transfer funds automatically, purely for record keeping.')) return
        setProcessingId(payoutId)
        try {
            const res = await approvePayout(payoutId)
            if (res.success) {
                toast.success('Payout marked as paid')
                setSelectedEvent(null)
            } else {
                toast.error(res.message)
            }
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (payoutId: string) => {
        const reason = prompt('Reason for rejection:')
        if (!reason) return
        setProcessingId(payoutId)
        try {
            const res = await rejectPayout(payoutId, reason)
            if (res.success) {
                toast.success('Payout rejected')
                setSelectedEvent(null)
            } else {
                toast.error(res.message)
            }
        } finally {
            setProcessingId(null)
        }
    }

    const filteredEvents = eventStats.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.organizers?.name?.toLowerCase().includes(search.toLowerCase())
    )

    const totalDue = filteredEvents.reduce((acc, e) => acc + e.stats.remainingDue, 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search events or organizers..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
                    />
                </div>
                <div className="flex items-center gap-4 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 px-6 py-3 rounded-2xl shadow-sm">
                    <div className="p-2 bg-green-500/10 rounded-full text-green-600 dark:text-green-400">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Payable</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalDue)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Event</th>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Organizer</th>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Gross Sales</th>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Fees</th>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Paid</th>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right text-green-600 dark:text-green-400">Net Due</th>
                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                            {filteredEvents.map(event => (
                                <tr key={event.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <p className="font-bold text-gray-900 dark:text-white">{event.title}</p>
                                            {event.activeRequest && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-100 dark:bg-yellow-500/10 px-2 py-0.5 rounded-full w-fit mt-1">
                                                    <Clock className="w-3 h-3" /> Request Pending
                                                </span>
                                            )}
                                            {!event.activeRequest && <p className="text-xs text-gray-500 mt-0.5">{event.stats.count} txns</p>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold">
                                                {event.organizers?.name?.[0]}
                                            </div>
                                            <span className="text-gray-600 dark:text-gray-300">{event.organizers?.name || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(event.stats.gross)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-red-500 font-medium text-xs">-{formatCurrency(event.stats.platformFees + event.stats.processorFees)}</span>
                                            <span className="text-[10px] text-gray-400">Plat: {formatCurrency(event.stats.platformFees)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500 font-medium">
                                        {formatCurrency(event.stats.amountPaid)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400 text-base">
                                        {formatCurrency(event.stats.remainingDue)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => setSelectedEvent(event)}
                                            className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-all"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredEvents.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            No events found matching your search.
                        </div>
                    )}
                </div>
            </div>

            {/* Slide-over Detail Panel */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#111] h-full shadow-2xl p-8 overflow-y-auto animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payout Details</h2>
                            <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {selectedEvent.activeRequest && (
                                <div className="p-6 bg-yellow-50 dark:bg-yellow-500/10 rounded-2xl border border-yellow-100 dark:border-yellow-500/20 animate-pulse-subtle">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Clock className="w-5 h-5 text-yellow-600" />
                                        <h3 className="font-bold text-yellow-800 dark:text-yellow-500">Payout Requested</h3>
                                    </div>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                                        {formatCurrency(selectedEvent.activeRequest.amount, selectedEvent.activeRequest.currency)}
                                    </p>
                                    <p className="text-sm text-gray-500 mb-6">
                                        Requested on {new Date(selectedEvent.activeRequest.created_at).toLocaleDateString()}
                                    </p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleReject(selectedEvent.activeRequest.id)}
                                            disabled={!!processingId}
                                            className="py-3 px-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(selectedEvent.activeRequest.id)}
                                            disabled={!!processingId}
                                            className="py-3 px-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {processingId === selectedEvent.activeRequest.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4" /> Mark Paid
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="p-6 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                                <p className="text-sm text-gray-500 mb-1">Remaining for Payout</p>
                                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{formatCurrency(selectedEvent.stats.remainingDue)}</p>
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Gross Collected</span>
                                        <span className="font-medium">{formatCurrency(selectedEvent.stats.gross)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Platform Fees</span>
                                        <span className="font-medium text-red-500">-{formatCurrency(selectedEvent.stats.platformFees)}</span>
                                    </div>
                                    <span className="text-gray-500">Process Fees</span>
                                    <span className="font-medium text-red-500">-{formatCurrency(selectedEvent.stats.processorFees)}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 mt-2 border-t border-gray-200 dark:border-white/5">
                                    <span className="text-gray-500">Total Paid Out</span>
                                    <span className="font-medium">{formatCurrency(selectedEvent.stats.amountPaid)}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Bank Details
                            </h3>
                            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-0.5">Bank Name</label>
                                    <p className="font-medium text-sm">{selectedEvent.organizers?.bank_name || 'Not set'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-0.5">Account Number</label>
                                        <p className="font-mono text-sm">{selectedEvent.organizers?.account_number || '---'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-0.5">Account Name</label>
                                        <p className="font-medium text-sm truncate">{selectedEvent.organizers?.account_name || '---'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Payout History
                            </h3>
                            <div className="space-y-3">
                                {selectedEvent.payouts && selectedEvent.payouts.length > 0 ? (
                                    selectedEvent.payouts.map((p: any) => (
                                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                                            <div>
                                                <p className="font-medium text-sm">{formatCurrency(p.amount)}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(p.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {p.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4">No payouts recorded yet.</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/10">
                            <button
                                onClick={() => {
                                    toast.info("Payout export coming soon")
                                }}
                                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Export Statement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
