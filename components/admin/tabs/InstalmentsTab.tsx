import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Download, Calendar, Mail, Phone, CheckCircle2, X, ChevronRight, MessageSquare, Loader2, Send } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import { sendManualSMS } from '@/app/actions/communications'
import { toast } from 'sonner'
import clsx from 'clsx'
import { formatCurrency } from '@/utils/format'
import { Event } from '@/types/gatepass'

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
    const [isSending, setIsSending] = useState<string | null>(null)
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

    const handleSendReminder = async (phone: string, name: string, amount: number, paymentId: string, type: 'general' | 'specific') => {
        if (!phone) {
            toast.error('No phone number found for this customer')
            return
        }

        setIsSending(type === 'specific' ? paymentId : 'general')
        try {
            // Use short_code if available, otherwise fallback to 8-char ID prefix
            const code = selectedRes.short_code || selectedRes.id.substring(0, 8)
            const portalUrl = `https://gatepass.so/i/${code}`
            
            const message = type === 'specific' 
                ? `GatePass: Hi ${name}, just a heads up for your installment payment of ${formatCurrency(amount, selectedRes.currency)} for "${event.title}". Pay here: ${portalUrl}`
                : `GatePass: Hi ${name}, you have a pending balance for "${event.title}". Please visit the portal to complete your payment: ${portalUrl}`

            const result = await sendManualSMS({
                to: phone,
                message,
                organizationId: event.organization_id!
            })

            if (result.success) {
                toast.success('SMS reminder sent successfully')
            } else {
                toast.error(result.error || 'Failed to send SMS')
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred')
        } finally {
            setIsSending(null)
        }
    }

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
        <div className="space-y-5 animate-in fade-in duration-200">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Instalments</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track payment plans and outstanding balances.</p>
            </div>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[
                    { label: 'Committed', value: stats.totalExpected, detail: 'Across payment plans' },
                    { label: 'Paid to date', value: stats.totalPaid, detail: 'Collected so far' },
                    { label: 'Remaining', value: stats.totalBalance, detail: 'Yet to be paid' },
                ].map((metric) => (
                    <div key={metric.label} className="col-span-1 min-w-0 rounded-3xl border border-gray-200 bg-white p-4 first:col-span-2 dark:border-white/10 dark:bg-[#0b0b0b] md:first:col-span-1 sm:p-5">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
                        <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white" title={formatCurrency(metric.value, event.currency || 'GHS')}>{loading && page === 0 ? 'Loading…' : formatCurrency(metric.value, event.currency || 'GHS')}</p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{count > reservations.length ? 'On this page' : metric.detail}</p>
                    </div>
                ))}
            </div>

            {/* List Table Card */}
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                <div className="flex flex-col gap-4 border-b border-gray-100 p-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between lg:p-6">
                    <div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-950 dark:text-white">Payment plans</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{count} {count === 1 ? 'commitment' : 'commitments'}</p>
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <div className="relative min-w-0 flex-1 lg:flex-none">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search customers"
                                aria-label="Search customers"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 lg:w-64"
                            />
                        </div>
                        <button
                            disabled={reservations.length === 0}
                            onClick={() => {
                                const csv = generateCSV(reservations)
                                downloadCSV(csv, `${event.slug}-instalments.csv`)
                            }}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                        >
                            <Download className="w-4 h-4 text-gray-400" />
                            Export page
                        </button>
                    </div>
                </div>

                {loading && page === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-5 py-16 text-center text-gray-500">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-black dark:border-white/10 dark:border-t-white" />
                        <span className="text-sm">Loading payment plans…</span>
                    </div>
                ) : displayReservations.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                                <tr>
                                    <th className="px-5 py-3 font-medium">Customer</th>
                                    <th className="px-5 py-3 font-medium">Amount</th>
                                    <th className="px-5 py-3 font-medium">Progress</th>
                                    <th className="px-5 py-3 font-medium">Remaining</th>
                                    <th className="px-5 py-3 font-medium">Next due</th>
                                    <th className="px-5 py-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {displayReservations.map((r) => (
                                    <tr
                                        key={r.id}
                                        onClick={() => setSelectedRes(r)}
                                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRes(r) } }}
                                        tabIndex={0}
                                        aria-label={`View payment plan for ${r.contact_name || 'guest'}`}
                                        className="group cursor-pointer transition-colors hover:bg-gray-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:hover:bg-white/5"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">
                                                    {(r.contact_name || 'G')[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">{r.contact_name || 'Guest'}</span>
                                                    <span className="text-xs text-gray-400">{r.contact_email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                                                {formatCurrency(r.total_amount, r.currency)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-2 min-w-[160px]">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{r.total_amount > 0 ? Math.round((r.amount_paid / r.total_amount) * 100) : 0}% paid</span>
                                                    <span className="text-xs text-gray-500">{formatCurrency(r.amount_paid, r.currency)}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-black dark:bg-white"
                                                        style={{ width: `${r.total_amount > 0 ? Math.min(100, Math.max(0, (r.amount_paid / r.total_amount) * 100)) : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                                                {formatCurrency(r.total_amount - r.amount_paid, r.currency)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {r.next_instalment_due_at ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {new Date(r.next_instalment_due_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500">Settled</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-between">
                                                <span className={clsx(
                                                    "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                                                    getStatusColor(r.status)
                                                )}>
                                                    {r.status}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-5 py-14 text-center">
                        <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">No payment plans yet</h3>
                        <p className="mx-auto max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            Instalment payment plans for this event will appear here once customers start reserving tickets.
                        </p>
                    </div>
                )}

                {count > ITEMS_PER_PAGE && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/10">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Showing {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, count)} of {count}
                        </span>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * ITEMS_PER_PAGE >= count}
                                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedRes && (
                <div className="pointer-events-none fixed inset-0 z-[200] flex items-end justify-center p-2 sm:items-center sm:p-5">
                    <div
                        className="pointer-events-auto fixed inset-0 bg-black/50"
                        onClick={() => setSelectedRes(null)}
                    />
                    <div role="dialog" aria-modal="true" aria-label="Payment plan details" className="pointer-events-auto relative flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0b0b0b] sm:max-h-[calc(100dvh-2.5rem)]">

                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 dark:border-white/10 sm:px-6">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">{selectedRes.contact_name || 'Guest'}</h2>
                                    <span className={clsx(
                                        "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                                        getStatusColor(selectedRes.status)
                                    )}>
                                        {selectedRes.status}
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-col gap-1 break-all text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                        {selectedRes.contact_email}
                                    </div>
                                    {selectedRes.contact_phone && (
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="h-3.5 w-3.5 shrink-0" />
                                            {selectedRes.contact_phone}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelectedRes(null)} aria-label="Close payment plan details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="mb-6 grid grid-cols-2 gap-3">
                                <div className="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-white/10">
                                    <span className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">Committed</span>
                                    <div className="truncate text-lg font-semibold tabular-nums text-gray-950 dark:text-white" title={formatCurrency(selectedRes.total_amount, selectedRes.currency)}>
                                        {formatCurrency(selectedRes.total_amount, selectedRes.currency)}
                                    </div>
                                </div>
                                <div className="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-white/10">
                                    <span className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">Paid so far</span>
                                    <div className="truncate text-lg font-semibold tabular-nums text-gray-950 dark:text-white" title={formatCurrency(selectedRes.amount_paid, selectedRes.currency)}>
                                        {formatCurrency(selectedRes.amount_paid, selectedRes.currency)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-950 dark:text-white">Payment schedule</h3>
                                {loadingPayments ? (
                                    <div className="py-10 text-center text-sm text-gray-500">Loading payments…</div>
                                ) : (
                                    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
                                        {payments.map((p) => (
                                            <div key={p.id} className="flex items-center gap-3 p-4">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">{p.instalment_number}</div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="text-sm font-semibold tabular-nums text-gray-950 dark:text-white">
                                                            {formatCurrency(p.amount, p.currency)}
                                                        </span>
                                                        <span className={clsx(
                                                            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                                                            getStatusColor(p.status)
                                                        )}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(p.due_at).toLocaleDateString()}
                                                        </div>
                                                        {p.paid_at && (
                                                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Paid {new Date(p.paid_at).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {p.status === 'pending' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleSendReminder(selectedRes.contact_phone, selectedRes.contact_name, p.amount, p.id, 'specific')
                                                        }}
                                                        disabled={isSending === p.id}
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-700 disabled:opacity-40 dark:border-white/10 dark:text-gray-300"
                                                        title="Send SMS reminder"
                                                        aria-label={`Send SMS reminder for payment ${p.instalment_number}`}
                                                    >
                                                        {isSending === p.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Send className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                            <button
                                onClick={() => handleSendReminder(selectedRes.contact_phone, selectedRes.contact_name, selectedRes.total_amount - selectedRes.amount_paid, selectedRes.id, 'general')}
                                disabled={!!isSending || selectedRes.status === 'completed'}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
                            >
                                {isSending === 'general' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <MessageSquare className="w-4 h-4" />
                                )}
                                Send SMS reminder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
