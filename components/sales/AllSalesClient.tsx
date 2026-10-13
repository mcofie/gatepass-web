'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
        <div className="space-y-7 pb-16">
            <div>
                <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                    <h1 className="text-[32px] font-semibold tracking-tight text-gray-950 dark:text-white sm:text-[38px]">Sales</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Review ticket purchases and open a transaction for details.</p>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Transactions</h2>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{count} completed sale{count === 1 ? '' : 's'}</p>
                    </div>
                </div>
                <div className="divide-y divide-gray-100 sm:hidden dark:divide-white/10">
                    {loading && sales.length === 0 ? (
                        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                    ) : sales.length === 0 ? (
                        <div className="px-5 py-16 text-center"><p className="font-medium text-gray-900 dark:text-white">No sales yet</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Completed purchases will appear here.</p></div>
                    ) : sales.map(sale => {
                        const reservation = sale.reservations
                        return (
                            <button
                                key={sale.id}
                                type="button"
                                onClick={() => { setSelectedTransaction(sale); setIsDetailOpen(true) }}
                                className="w-full px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{reservation?.profiles?.full_name || reservation?.guest_name || 'Guest'}</p>
                                        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{reservation?.events?.title} · {reservation?.ticket_tiers?.name}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Paid</p>
                                        <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{formatCurrency(sale.amount, sale.currency)}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <span>{formatDateTime(sale.created_at)}</span>
                                    <span>View details →</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
                <div className="overflow-x-auto">
                    <table className="hidden min-w-[760px] w-full text-left text-sm sm:table">
                        <thead className="border-b border-gray-100 bg-gray-50/70 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Guest</th>
                                <th className="px-6 py-4">Event & Ticket</th>
                                <th className="hidden px-6 py-4 xl:table-cell">Add-ons</th>
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

                                    // 3. Detect instalment and fee bearer
                                    const isInstalment = sale.metadata?.payment_type === 'instalment' ||
                                        sale.metadata?.metadata?.payment_type === 'instalment'
                                    const feeBearer = event?.fee_bearer || 'customer'

                                    // 4. Fee Logic
                                    const purchasedAddons = r.addons || {}
                                    let addonRevenue = 0
                                    if (typeof purchasedAddons === 'object') {
                                        Object.entries(purchasedAddons).forEach(([id, qty]) => {
                                            const p = addonPrices[id] || 0
                                            addonRevenue += p * (qty as number)
                                        })
                                    }

                                    // A stored 0 is a GatePass-era sale with no per-ticket fee; only missing rates fall back
                                    const usedPlatformRate = sale.applied_fee_rate ?? 0.04

                                    // Normalize old 2% rate to current 1.95%
                                    const storedProcessorRate = sale.applied_processor_rate
                                    const processorRate = (storedProcessorRate === 0.02 || storedProcessorRate == null)
                                        ? 0.0195
                                        : storedProcessorRate

                                    // Platform fee: use stored value, or calculate proportionally for instalments
                                    let finalPlatformFee = sale.platform_fee
                                    if (finalPlatformFee == null || finalPlatformFee === 0) {
                                        finalPlatformFee = isInstalment
                                            ? sale.amount * usedPlatformRate  // Proportional to instalment amount
                                            : ticketRevenueNet * usedPlatformRate  // Standard: % of ticket revenue
                                    }

                                    const finalProcessorFee = (sale.applied_processor_fee != null)
                                        ? sale.applied_processor_fee
                                        : sale.amount * processorRate

                                    // Payout: When customer bears fees, processor fee is NOT deducted from organizer
                                    // (Paystack charges it to the platform account via bearer:'account')
                                    const organizerPayout = feeBearer === 'customer'
                                        ? sale.amount - finalPlatformFee  // Customer bears: organizer only pays platform fee
                                        : sale.amount - finalPlatformFee - finalProcessorFee  // Organizer bears: pays both

                                    // purchasedAddons already defined above
                                    const visibleAddons = Object.entries(purchasedAddons).filter(([, qty]) => Number(qty) > 0)
                                    const hasAddons = visibleAddons.length > 0

                                    return (
                                        <tr
                                            key={sale.id}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`Open transaction for ${r?.profiles?.full_name || r?.guest_name || 'Guest'}`}
                                            onClick={() => {
                                                setSelectedTransaction(sale)
                                                setIsDetailOpen(true)
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    setSelectedTransaction(sale)
                                                    setIsDetailOpen(true)
                                                }
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
                                            <td className="hidden px-6 py-4 xl:table-cell">
                                                {hasAddons ? (
                                                    <div className="space-y-1">
                                                        {visibleAddons.map(([id, qty]) => (
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
                                                <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                                                    {formatCurrency(organizerPayout, sale.currency)}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center text-gray-400">
                                        <div className="font-medium text-gray-900 dark:text-white">No sales yet</div>
                                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Completed ticket purchases will appear here.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {count > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/10">
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
