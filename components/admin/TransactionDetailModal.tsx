'use client'

import React from 'react'
import { X, Calendar, User, Mail, CreditCard, Hash, Receipt, CheckCircle, Clock } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { calculateFees, PLATFORM_FEE_PERCENT, PROCESSOR_FEE_PERCENT } from '@/utils/fees'
import { Discount } from '@/types/gatepass'

interface TransactionDetailModalProps {
    transaction: any
    isOpen: boolean
    onClose: () => void
    eventFeeBearer?: 'customer' | 'organizer'
}

export function TransactionDetailModal({ transaction, isOpen, onClose, eventFeeBearer = 'customer' }: TransactionDetailModalProps) {
    if (!isOpen || !transaction) return null

    const r = transaction.reservations
    const quantity = r?.quantity || 1
    const totalPaid = transaction.amount

    // REVERSE CALCULATE to ensure "True Representation" of what actually happened
    // instead of hypothetical calculation based on current settings.

    // 1. Determine effective fee rates based on who bore the fees
    const feeBearer = eventFeeBearer

    // Based on utils/fees.ts:
    // If Customer: pays Platform (4%) + Processor (1.98%) -> Rate = 0.0598
    // If Organizer: Customer pays Platform (4%) -> Rate = 0.04
    // (Note: This assumes fees.ts logic where platform fee is always added)
    const effectiveFeeRate = feeBearer === 'customer'
        ? (PLATFORM_FEE_PERCENT + PROCESSOR_FEE_PERCENT)
        : PLATFORM_FEE_PERCENT

    // 2. Derive Subtotal (The amount attributed to tickets after removing added fees)
    // Total = Subtotal * (1 + Rate)
    // Subtotal = Total / (1 + Rate)
    const derivedSubtotal = totalPaid / (1 + effectiveFeeRate)

    // 3. Calculate the component fees based on this derived subtotal
    const platformFee = derivedSubtotal * PLATFORM_FEE_PERCENT
    const processorFee = derivedSubtotal * PROCESSOR_FEE_PERCENT
    const clientFees = totalPaid - derivedSubtotal // exact difference

    // 4. Calculate Payout
    // If Organizer: Pays Processor Fee from Subtotal
    // If Customer: Organizer gets full Subtotal
    const organizerPayout = feeBearer === 'organizer'
        ? derivedSubtotal - processorFee
        : derivedSubtotal

    // 5. Handle Discount for display (it's already factored into the Total/Subtotal)
    // We just show it for context.
    const discount = Array.isArray(r.discounts) ? r.discounts[0] : r.discounts
    let discountAmount = 0
    if (discount) {
        // We can try to estimate the pre-discount price derivedSubtotal + discount
        // But for display, we'll just show the discount value if fixed, or calc %
        if (discount.type === 'fixed') discountAmount = discount.value
        // percentage is harder to show exact amount without original price, but we can try:
        // derivedSubtotal = (Original * (1 - discount%))
        // Original = derivedSubtotal / (1 - discount%)
        else if (discount.type === 'percentage') {
            const originalParam = derivedSubtotal / (1 - (discount.value / 100))
            discountAmount = originalParam - derivedSubtotal
        }
    }

    // Gross = what the tickets were worth before discount
    const grossAmount = derivedSubtotal + discountAmount
    const displayPrice = grossAmount / quantity


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
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Ticket Price</span>
                            <span className="font-medium dark:text-gray-200">{formatCurrency(displayPrice, transaction.currency)} × {quantity}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-white/10 border-dashed">
                            <span>Gross Amount</span>
                            <span>{formatCurrency(grossAmount, transaction.currency)}</span>
                        </div>

                        {discountAmount > 0 && (
                            <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                                <span className="flex items-center gap-1"><Receipt className="w-3 h-3" /> Discount ({discount?.code})</span>
                                <span>- {formatCurrency(discountAmount, transaction.currency)}</span>
                            </div>
                        )}

                        {/* Subtotal before fees */}
                        <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white">
                            <span>Subtotal</span>
                            <span>{formatCurrency(derivedSubtotal, transaction.currency)}</span>
                        </div>

                        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                            <span>Fees (Paid by Customer)</span>
                            <span>
                                + {formatCurrency(clientFees, transaction.currency)}
                            </span>
                        </div>

                        <div className="flex justify-between text-sm font-bold text-black dark:text-white border-t border-gray-200 dark:border-white/10 pt-2 border-dashed">
                            <span>Total Charge</span>
                            <span>{formatCurrency(totalPaid, transaction.currency)}</span>
                        </div>

                        {/* Payout Section */}
                        <div className="mt-4 pt-4 border-t-4 border-gray-200/50 dark:border-white/10">
                            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
                                <span>Processing Fee (Paid by You)</span>
                                <span className={feeBearer === 'organizer' ? 'text-red-500 dark:text-red-400' : ''}>
                                    {feeBearer === 'organizer' ? `- ${formatCurrency(processorFee, transaction.currency)}` : '0.00'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <span className="font-bold text-gray-900 dark:text-white">Net Payout</span>
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
                                    {(r?.profiles?.full_name || r?.guest_name || '?')[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{r?.profiles?.full_name || r?.guest_name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{r?.profiles?.email || r?.guest_email}</p>
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
