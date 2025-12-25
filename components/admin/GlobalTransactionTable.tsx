'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import { ChevronLeft, ChevronRight, Loader2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

const ITEMS_PER_PAGE = 20

export default function GlobalTransactionTable() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [sales, setSales] = useState<any[]>([])
    const [page, setPage] = useState(0)
    const [count, setCount] = useState(0)

    useEffect(() => {
        fetchSales()
    }, [page])

    const fetchSales = async () => {
        setLoading(true)
        try {
            const start = page * ITEMS_PER_PAGE
            const end = start + ITEMS_PER_PAGE - 1

            const { data, error, count: totalCount } = await supabase
                .schema('gatepass')
                .from('transactions')
                .select(`
                    id,
                    created_at,
                    amount,
                    currency,
                    status,
                    platform_fee,
                    reservations!inner (
                        quantity,
                        guest_name,
                        guest_email,
                        profiles ( full_name, email ),
                        ticket_tiers ( name, price ),
                        events!inner ( 
                            title, 
                            organization_id, 
                            fee_bearer,
                            organizers ( name )
                        ),
                        discounts ( type, value ),
                        addons
                    )
                `, { count: 'exact' })
                .eq('status', 'success')
                .order('created_at', { ascending: false })
                .range(start, end)

            if (error) throw error

            setSales(data || [])
            setCount(totalCount || 0)
        } catch (error: any) {
            console.error('Error fetching sales:', error)
            toast.error('Failed to load global sales')
        } finally {
            setLoading(false)
        }
    }

    const totalPages = Math.ceil(count / ITEMS_PER_PAGE)

    return (
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-white/5 text-gray-200 uppercase tracking-wider text-xs font-bold border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Guest</th>
                            <th className="px-6 py-4">Event & Organization</th>
                            <th className="px-6 py-4 text-center">Qty</th>
                            <th className="px-6 py-4 text-right">Total Paid</th>
                            <th className="px-6 py-4 text-right">Platform Fee</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {loading && sales.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-24 text-center">
                                    <div className="flex justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                </td>
                            </tr>
                        ) : sales.length > 0 ? (
                            sales.map((sale) => {
                                const r = sale.reservations
                                const event = r?.events
                                const organizer = event?.organizers
                                const tier = r?.ticket_tiers
                                const discount = Array.isArray(r.discounts) ? r.discounts[0] : r.discounts

                                const price = tier?.price || 0
                                const quantity = r?.quantity || 1

                                // 1. Calculate Discount
                                let discountAmount = 0
                                if (discount) {
                                    if (discount.type === 'percentage') {
                                        discountAmount = (price * quantity) * (discount.value / 100)
                                    } else {
                                        discountAmount = discount.value
                                    }
                                }

                                // 2. Subtotal (Tickets Only)
                                const ticketSubtotal = Math.max(0, (price * quantity) - discountAmount)

                                // 3. Fee Logic
                                // Prefer DB values for accuracy
                                let platformFee = sale.platform_fee
                                let totalPaid = sale.amount

                                // Fallback Calculation (Approximate as we don't have addon prices here easily)
                                if (platformFee === null || platformFee === undefined) {
                                    const feeBearer = event?.fee_bearer || 'customer'
                                    // Note: We are passing 0 for addons here as we don't have prices loaded. 
                                    // This is a limitation but DB value should exist for all valid transactions.
                                    const calculated = calculateFees(ticketSubtotal, 0, feeBearer)
                                    platformFee = calculated.platformFee
                                    // Only override totalPaid if it was missing/zero? Unlikely.
                                }

                                return (
                                    <tr key={sale.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {formatDateTime(sale.created_at)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                                                    {r?.profiles?.full_name?.charAt(0) || r?.guest_name?.charAt(0) || 'G'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white leading-tight">{r?.profiles?.full_name || r?.guest_name || 'Guest'}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{r?.profiles?.email || r?.guest_email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-white">{event?.title}</p>
                                            <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                                                By {organizer?.name || 'Unknown'} • {tier?.name}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500 font-mono">
                                            {quantity}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-white tabular-nums">
                                                {formatCurrency(totalPaid, sale.currency)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-purple-400 tabular-nums">
                                                {formatCurrency(platformFee, sale.currency)}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-24 text-center text-gray-500">
                                    No transaction history found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {count > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
                    <p className="text-sm text-gray-500">
                        Showing <span className="font-medium text-white">{Math.min(count, page * ITEMS_PER_PAGE + 1)}</span> to <span className="font-medium text-white">{Math.min(count, (page + 1) * ITEMS_PER_PAGE)}</span> of <span className="font-medium text-white">{count}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
