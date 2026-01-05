'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import { ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'

import { TransactionDetailModal } from '@/components/admin/TransactionDetailModal'

interface AllSalesClientProps {
    orgId: string
}

const ITEMS_PER_PAGE = 20

export function AllSalesClient({ orgId }: AllSalesClientProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [sales, setSales] = useState<any[]>([])
    const [page, setPage] = useState(0)
    const [count, setCount] = useState(0)
    const [addonMap, setAddonMap] = useState<Record<string, string>>({}) // ID -> Name
    const [addonPrices, setAddonPrices] = useState<Record<string, number>>({}) // ID -> Price

    // Modal State
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    useEffect(() => {
        fetchSales()
    }, [page, orgId])




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
                    metadata,
                    reservation_id,
                    platform_fee,
                    applied_processor_fee,
                    applied_fee_rate, 
                    applied_processor_rate,
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
                            platform_fee_percent,
                            organizers ( platform_fee_percent ) 
                        ),
                        discounts ( type, value, code ),
                        addons
                    )
                `, { count: 'exact' })
                .eq('status', 'success')
                .eq('reservations.events.organization_id', orgId)
                .order('created_at', { ascending: false })
                .range(start, end)

            if (error) throw error

            setSales(data || [])
            setCount(totalCount || 0)

            // Valid Sales with Addons
            const addonIds = new Set<string>()
            try {
                data?.forEach((sale: any) => {
                    const addons = sale.reservations?.addons
                    if (addons && typeof addons === 'object') {
                        Object.keys(addons).forEach(id => addonIds.add(id))
                    }
                })

                if (addonIds.size > 0) {
                    const { data: addonsData } = await supabase
                        .schema('gatepass')
                        .from('event_addons')
                        .select('id, name, price')
                        .in('id', Array.from(addonIds))

                    if (addonsData) {
                        const map: Record<string, string> = {}
                        const prices: Record<string, number> = {}
                        addonsData.forEach((a: any) => {
                            map[a.id] = a.name
                            prices[a.id] = a.price
                        })
                        setAddonMap(map)
                        setAddonPrices(prices)
                    }
                }
            } catch (err) {
                console.error('Failed to fetch addon details:', err)
                // Do not fail the whole request, just show IDs or 'Add-on'
            }

        } catch (error) {
            console.error('Error fetching sales:', error)
            toast.error('Failed to load sales history')
        } finally {
            setLoading(false)
        }
    }

    const totalPages = Math.ceil(count / ITEMS_PER_PAGE)

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Sales History</h1>
                    <p className="text-gray-500 mt-2 dark:text-gray-400">View and manage all your ticket sales.</p>
                </div>
                <div className="hidden">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Guest</th>
                                <th className="px-6 py-4">Event & Ticket</th>
                                <th className="px-6 py-4">Add-ons</th>
                                <th className="px-6 py-4 text-center">Qty</th>
                                <th className="px-6 py-4 text-right">Net Earnings</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
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

                                    // 2. Subtotal (Net of Discount)
                                    const ticketRevenueNet = Math.max(0, (price * quantity) - discountAmount)

                                    // 3. Fee Logic (Consistent with Modal)
                                    // Use stored rates if available, else defaults (0.04 & 0.0198)
                                    // But to be "Fix Across", we should prioritize what the Modal does:
                                    // The Modal uses `transaction.applied_fee_rate` or 0.04.

                                    const purchasedAddons = r.addons || {}
                                    let addonRevenue = 0
                                    if (typeof purchasedAddons === 'object') {
                                        Object.entries(purchasedAddons).forEach(([id, qty]) => {
                                            const p = addonPrices[id] || 0
                                            addonRevenue += p * (qty as number)
                                        })
                                    }

                                    // Fix Across Logic:
                                    // If stored rate is 0/null, assume it's a legacy/buggy record and use the effective/standard rate
                                    // We need to fetch/determine the effective rate. We can default to 4% if not available (safe for this specific user request)
                                    // or better, use the stored rate if > 0.

                                    let usedPlatformRate = sale.applied_fee_rate ?? 0.04
                                    if (usedPlatformRate === 0) usedPlatformRate = 0.04

                                    const processorRate = sale.applied_processor_rate ?? 0.0198

                                    const calcPlatformFee = ticketRevenueNet * usedPlatformRate
                                    const calcProcessorFee = sale.amount * processorRate

                                    // Prefer stored fee for accuracy with history
                                    // BUT if stored fee is 0 and we expect a fee, RECALCULATE IT
                                    let finalPlatformFee = sale.platform_fee
                                    if ((finalPlatformFee === 0 || finalPlatformFee === null || finalPlatformFee === undefined) && usedPlatformRate > 0 && ticketRevenueNet > 0) {
                                        finalPlatformFee = calcPlatformFee
                                    } else if (finalPlatformFee === null || finalPlatformFee === undefined) {
                                        finalPlatformFee = calcPlatformFee
                                    }

                                    const finalProcessorFee = (sale.applied_processor_fee !== null && sale.applied_processor_fee !== undefined) ? sale.applied_processor_fee : calcProcessorFee

                                    const expectedTotalFees = finalPlatformFee + finalProcessorFee

                                    // Payout = Total Paid - Fees
                                    // This applies for BOTH fee bearers (mathematically equivalent for Net Payout view)
                                    // If Customer Pays: Total = 2.08. Fees = 0.08. Payout = 2.00.
                                    // If Organizer Pays: Total = 2.00. Fees = 0.08. Payout = 1.92.

                                    const organizerPayout = sale.amount - expectedTotalFees

                                    // purchasedAddons already defined above
                                    const hasAddons = Object.keys(purchasedAddons).length > 0

                                    return (
                                        <tr
                                            key={sale.id}
                                            onClick={() => {
                                                setSelectedTransaction(sale)
                                                setIsDetailOpen(true)
                                            }}
                                            className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                {formatDateTime(sale.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-bold">
                                                        {r?.profiles?.full_name?.charAt(0) || r?.guest_name?.charAt(0) || 'G'}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{r?.profiles?.full_name || r?.guest_name || 'Guest'}</p>
                                                        <p className="text-gray-500 dark:text-gray-400 text-xs">{r?.profiles?.email || r?.guest_email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">{event?.title}</span>
                                                    <span className="text-gray-500 dark:text-gray-400 text-xs">{tier?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {hasAddons ? (
                                                    <div className="space-y-1">
                                                        {Object.entries(purchasedAddons).map(([id, qty]) => (
                                                            <div key={id} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                                                <span className="font-medium bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">{qty as number}x</span>
                                                                <span>{addonMap[id] || 'Add-on'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 font-medium">
                                                {quantity}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-bold text-green-600 dark:text-green-400 tabular-nums">
                                                    +{formatCurrency(organizerPayout, sale.currency)}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center text-gray-400">
                                        No sales found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {count > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/30 dark:bg-white/5">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Showing <span className="font-medium">{Math.min(count, page * ITEMS_PER_PAGE + 1)}</span> to <span className="font-medium">{Math.min(count, (page + 1) * ITEMS_PER_PAGE)}</span> of <span className="font-medium">{count}</span> results
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <TransactionDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                transaction={selectedTransaction}
                eventFeeBearer={selectedTransaction?.reservations?.events?.fee_bearer}
            />
        </div>
    )
}
