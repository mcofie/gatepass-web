'use client'

import React, { useEffect, useState } from 'react'
import { X, Calendar, User, Mail, CreditCard, Hash, Receipt, CheckCircle, Clock } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { createClient } from '@/utils/supabase/client'

interface TransactionDetailModalProps {
    transaction: any
    isOpen: boolean
    onClose: () => void
    eventFeeBearer?: 'customer' | 'organizer'
}

export function TransactionDetailModal({ transaction, isOpen, onClose, eventFeeBearer = 'customer' }: TransactionDetailModalProps) {
    const [reservations, setReservations] = useState<any[]>([])
    const [addonDetails, setAddonDetails] = useState<Record<string, { name: string, price: number }>>({})
    const supabase = createClient()

    useEffect(() => {
        if (!transaction) return

        const fetchReservations = async () => {
            // Try to get reservation ID(s)
            let reservationIds: string[] = []

            // Check direct reservation link
            if (transaction.reservation_id) {
                reservationIds = [transaction.reservation_id]
            }

            // Also check metadata for multi-reservation
            let metaIds = transaction.metadata?.reservation_ids

            // Fallback: Nested Metadata
            if (!metaIds && transaction.metadata?.metadata?.reservation_ids) {
                metaIds = transaction.metadata.metadata.reservation_ids
            }

            // Fallback: Custom Fields
            if (!metaIds) {
                const fields = transaction.metadata?.custom_fields || transaction.metadata?.metadata?.custom_fields
                if (Array.isArray(fields)) {
                    const f = fields.find((x: any) => x.variable_name === 'reservation_ids')
                    if (f?.value) {
                        metaIds = f.value.split(',').map((s: string) => s.trim())
                    }
                }
            }

            if (Array.isArray(metaIds) && metaIds.length > 0) {
                reservationIds = metaIds
            }

            // Always fetch fresh data with full relations
            if (reservationIds.length > 0) {
                const { data } = await supabase
                    .schema('gatepass')
                    .from('reservations')
                    .select('*, ticket_tiers(*), events(*), discounts(*), profiles(full_name, email)')
                    .in('id', reservationIds)

                if (data && data.length > 0) {
                    setReservations(data)

                    // Collect all addon IDs and fetch their details
                    const allAddonIds: string[] = []
                    data.forEach(r => {
                        if (r.addons && typeof r.addons === 'object') {
                            Object.keys(r.addons).forEach(id => {
                                if (!allAddonIds.includes(id)) allAddonIds.push(id)
                            })
                        }
                    })

                    if (allAddonIds.length > 0) {
                        const { data: addonsData } = await supabase
                            .schema('gatepass')
                            .from('event_addons')
                            .select('id, name, price')
                            .in('id', allAddonIds)

                        if (addonsData) {
                            const addonMap: Record<string, { name: string, price: number }> = {}
                            addonsData.forEach(a => {
                                addonMap[a.id] = { name: a.name, price: a.price }
                            })
                            setAddonDetails(addonMap)
                        }
                    }
                    return
                }
            }

            // Fallback to joined reservation if available
            if (transaction.reservations) {
                setReservations([transaction.reservations])
            }
        }

        fetchReservations()
    }, [transaction?.id, transaction?.metadata, isOpen])

    if (!isOpen || !transaction) return null

    // Aggregation Logic
    let totalQuantity = 0
    let totalTicketRevenueRaw = 0
    let totalDiscountAmount = 0
    let discountCode: string | null = null
    let discountPercent: number | null = null
    let hasAddons = false
    let addonData: Record<string, number> = {}

    // We use the first reservation for generic profile/event info
    const primaryRes = reservations.length > 0 ? reservations[0] : transaction.reservations

    reservations.forEach(r => {
        const qty = r.quantity || 1
        const price = r.ticket_tiers?.price || 0
        totalQuantity += qty
        totalTicketRevenueRaw += (price * qty)

        // Discount
        const discount = Array.isArray(r.discounts) ? r.discounts[0] : r.discounts
        if (discount && discount.value) {
            discountCode = discount.code || discountCode
            if (discount.type === 'fixed') {
                totalDiscountAmount += discount.value
            } else if (discount.type === 'percentage') {
                discountPercent = discount.value
                totalDiscountAmount += (price * qty) * (discount.value / 100)
            }
        }

        // Addons
        if (r.addons && typeof r.addons === 'object' && Object.keys(r.addons).length > 0) {
            hasAddons = true
            addonData = { ...addonData, ...r.addons }
        }
    })

    const totalPaid = transaction.amount
    const feeBearer = eventFeeBearer

    // Effective Calculations
    // Net Ticket Revenue (Base for Platform Fee)
    const ticketRevenueNetBase = Math.max(0, totalTicketRevenueRaw - totalDiscountAmount)

    const effectiveRates = {
        platformFeePercent: transaction.applied_fee_rate || 0.04,
        processorFeePercent: transaction.applied_processor_rate || 0.0195
    }

    // Recalc Fees
    const calcPlatformFee = ticketRevenueNetBase * effectiveRates.platformFeePercent
    const calcProcessorFee = totalPaid * effectiveRates.processorFeePercent
    const expectedTotalFees = calcPlatformFee + calcProcessorFee

    // Payout
    const expectedPayout = totalPaid - expectedTotalFees

    // Calculate actual add-on revenue from fetched details
    let addonRevenue = 0
    const addonItems: { name: string, quantity: number, total: number }[] = []

    if (hasAddons && Object.keys(addonData).length > 0) {
        Object.entries(addonData).forEach(([addonId, qty]) => {
            const detail = addonDetails[addonId]
            if (detail && qty > 0) {
                const total = detail.price * (qty as number)
                addonRevenue += total
                addonItems.push({ name: detail.name, quantity: qty as number, total })
            }
        })
    }

    // Variables for Display
    const displayPlatformFee = calcPlatformFee
    const displayProcessorFee = calcProcessorFee
    const organizerPayout = expectedPayout

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#111] rounded-3xl w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden border border-transparent dark:border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Details</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">{transaction.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">

                    {/* Status Badge */}
                    <div className="flex justify-center">
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold capitalize ${transaction.status === 'success'
                            ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-white/10 dark:text-gray-400 dark:border-white/10'
                            }`}>
                            {transaction.status === 'success' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            Payment {transaction.status}
                        </div>
                    </div>

                    {/* Financial Breakdown (Receipt Style) */}
                    <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 space-y-3 border border-gray-100 dark:border-white/10">

                        {/* 1. GROSS REVENUE SECTION */}
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Tickets ({totalQuantity}x)</span>
                            <span className="font-medium dark:text-gray-200">{formatCurrency(totalTicketRevenueRaw, transaction.currency)}</span>
                        </div>

                        {/* Detail of Tiers if multiple */}
                        {reservations.length > 1 && (
                            <div className="pl-4 border-l-2 border-gray-200 dark:border-white/10 space-y-1 mb-2">
                                {reservations.map(r => (
                                    <div key={r.id} className="flex justify-between text-xs text-gray-400">
                                        <span>{r.ticket_tiers?.name} ({r.quantity}x)</span>
                                        <span>{formatCurrency((r.ticket_tiers?.price || 0) * (r.quantity || 1), transaction.currency)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {addonItems.length > 0 && (
                            <>
                                {addonItems.map((addon, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                            <span className="w-3 h-3 flex items-center justify-center text-[10px]">+</span>
                                            {addon.name} ({addon.quantity}x)
                                        </span>
                                        <span className="font-medium text-purple-600 dark:text-purple-400">
                                            {formatCurrency(addon.total, transaction.currency)}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}

                        <div className="border-b border-gray-200 dark:border-white/10 border-dashed my-2 opacity-50"></div>

                        {/* 2. DEDUCTIONS SECTION */}
                        {totalDiscountAmount > 0 && (
                            <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                                <span className="flex items-center gap-1">
                                    <Receipt className="w-3 h-3" />
                                    Discount
                                    {discountCode && (
                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-[10px] font-bold">
                                            {discountCode}
                                        </span>
                                    )}
                                    {discountPercent && (
                                        <span className="text-xs opacity-70">({discountPercent}% off)</span>
                                    )}
                                </span>
                                <span>- {formatCurrency(totalDiscountAmount, transaction.currency)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-sm text-red-500">
                            <span className="flex items-center gap-1">
                                <span>Platform Fee ({effectiveRates.platformFeePercent * 100}%)</span>
                            </span>
                            <span>- {formatCurrency(displayPlatformFee, transaction.currency)}</span>
                        </div>

                        <div className="flex justify-between text-sm text-red-500">
                            <span className="flex items-center gap-1">
                                <span>Processor Fee ({(effectiveRates.processorFeePercent * 100).toFixed(2)}%)</span>
                            </span>
                            <span>- {formatCurrency(displayProcessorFee, transaction.currency)}</span>
                        </div>

                        {/* 3. NET PAYOUT SECTION */}
                        <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-white/10">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 dark:text-white text-lg">Net Payout</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Transferable Balance</span>
                                </div>
                                <span className="font-black text-2xl text-green-600 dark:text-green-400 tracking-tight">
                                    {formatCurrency(organizerPayout, transaction.currency)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Meta Data Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <Calendar className="w-3 h-3" /> Date
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(transaction.created_at)}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <Hash className="w-3 h-3" /> Reference
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{transaction.reference || 'N/A'}</p>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <User className="w-3 h-3" /> Customer
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                                    {(primaryRes?.profiles?.full_name || primaryRes?.guest_name || '?')[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{primaryRes?.profiles?.full_name || primaryRes?.guest_name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{primaryRes?.profiles?.email || primaryRes?.guest_email}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
