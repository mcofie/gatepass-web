'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, CalendarClock, CheckCircle2, Clock, AlertCircle,
    CreditCard, MapPin, Calendar, XCircle, Loader2
} from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { toast } from 'sonner'

interface InstalmentDetailClientProps {
    instalment: any
}

export default function InstalmentDetailClient({ instalment }: InstalmentDetailClientProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [payingInstalmentId, setPayingInstalmentId] = useState<string | null>(null)

    const reservation = instalment.reservations
    const event = reservation?.events
    const tier = reservation?.ticket_tiers
    const payments = instalment.instalment_payments || []
    const plan = instalment.payment_plans

    const progressPct = Math.round((instalment.amount_paid / instalment.total_amount) * 100)
    const remaining = instalment.total_amount - instalment.amount_paid

    // Find next pending payment
    const nextPayment = payments
        .filter((p: any) => p.status === 'pending' || p.status === 'overdue')
        .sort((a: any, b: any) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0]

    const handlePayInstalment = async (payment: any) => {
        setLoading(true)
        setPayingInstalmentId(payment.id)

        try {
            // Initialize Paystack for this instalment
            const email = instalment.contact_email || 'customer@gatepass.com'
            const callbackUrl = `${window.location.protocol}//${window.location.host}/my-tickets/instalments/${instalment.id}/payment-callback?instalment_payment_id=${payment.id}`

            const response = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    amount: Math.round(payment.amount * 100), // In kobo/pesewas
                    currency: payment.currency || instalment.currency || 'GHS',
                    reservationIds: [instalment.reservation_id],
                    callbackUrl,
                    metadata: {
                        instalment_reservation_id: instalment.id,
                        instalment_payment_id: payment.id,
                        instalment_number: payment.instalment_number,
                        payment_type: 'instalment'
                    }
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Payment initialization failed')

            window.location.href = data.authorization_url
        } catch (error: any) {
            console.error('Instalment Payment Error:', error)
            toast.error(error.message || 'Failed to initialize payment')
            setLoading(false)
            setPayingInstalmentId(null)
        }
    }

    const getPaymentStatusConfig = (status: string) => {
        switch (status) {
            case 'paid':
                return { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/5', label: 'Paid' }
            case 'pending':
                return { icon: <Clock className="w-4 h-4 text-gray-400" />, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-zinc-800', label: 'Pending' }
            case 'overdue':
                return { icon: <AlertCircle className="w-4 h-4 text-red-500" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/5', label: 'Overdue' }
            case 'failed':
                return { icon: <XCircle className="w-4 h-4 text-red-500" />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/5', label: 'Failed' }
            default:
                return { icon: null, color: 'text-gray-500', bg: 'bg-gray-50', label: status }
        }
    }

    return (
        <div className="w-full">
            <div className="w-full">
                {/* Back */}
                <Link
                    href="/my-tickets"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to My Tickets
                </Link>

                {/* Event Info */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 mb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{event?.title}</h1>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {event?.venue_name && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {event.venue_name}
                                    </span>
                                )}
                                {event?.starts_at && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(event.starts_at).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${instalment.status === 'completed' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                            instalment.status === 'forfeited' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
                                'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            }`}>
                            {instalment.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                                instalment.status === 'forfeited' ? <XCircle className="w-3.5 h-3.5" /> :
                                    <CalendarClock className="w-3.5 h-3.5" />}
                            {instalment.status.charAt(0).toUpperCase() + instalment.status.slice(1)}
                        </div>
                    </div>

                    {/* Ticket Info */}
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 flex justify-between items-center">
                        <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Ticket</span>
                            <p className="font-bold text-gray-900 dark:text-white">
                                {reservation?.quantity || 1}x {typeof tier === 'object' && !Array.isArray(tier) ? tier.name : 'Ticket'}
                            </p>
                        </div>
                        {instalment.status === 'completed' && (
                            <Link
                                href="/my-tickets"
                                className="bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                            >
                                View Tickets
                            </Link>
                        )}
                    </div>
                </div>

                {/* Progress Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Payment Progress</h2>

                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-gray-900 dark:text-white">{progressPct}% Complete</span>
                            <span className="text-gray-500 dark:text-gray-400">
                                {formatCurrency(instalment.amount_paid, instalment.currency)} / {formatCurrency(instalment.total_amount, instalment.currency)}
                            </span>
                        </div>
                        <div className="bg-gray-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${instalment.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                    instalment.status === 'forfeited' ? 'bg-red-500' :
                                        'bg-gradient-to-r from-amber-400 to-amber-500'
                                    }`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Summary Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-500/5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Paid</span>
                            <p className="font-bold text-green-700 dark:text-green-300 mt-1">
                                {formatCurrency(instalment.amount_paid, instalment.currency)}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 dark:bg-amber-500/5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Remaining</span>
                            <p className="font-bold text-amber-700 dark:text-amber-300 mt-1">
                                {formatCurrency(remaining, instalment.currency)}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</span>
                            <p className="font-bold text-gray-900 dark:text-white mt-1">
                                {formatCurrency(instalment.total_amount, instalment.currency)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Payment Schedule */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Payment Schedule</h2>
                    <div className="space-y-3">
                        {payments.map((payment: any, index: number) => {
                            const config = getPaymentStatusConfig(payment.status)
                            const isNext = nextPayment?.id === payment.id
                            const isOverdue = payment.status === 'overdue' || (payment.status === 'pending' && new Date(payment.due_at) < new Date())
                            const isPayable = (payment.status === 'pending' || payment.status === 'overdue') && instalment.status === 'active'

                            return (
                                <div
                                    key={payment.id}
                                    className={`rounded-xl border-2 p-4 transition-all ${isNext
                                        ? isOverdue
                                            ? 'border-red-300 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5'
                                            : 'border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
                                        : payment.status === 'paid'
                                            ? 'border-green-100 dark:border-green-500/10 bg-green-50/30 dark:bg-green-500/[0.02]'
                                            : 'border-gray-100 dark:border-zinc-800'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bg}`}>
                                                {config.icon}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                                    Payment {payment.instalment_number}
                                                </p>
                                                <p className={`text-xs ${config.color}`}>
                                                    {payment.status === 'paid'
                                                        ? `Paid ${payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
                                                        : `Due ${new Date(payment.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <span className="font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(payment.amount, payment.currency)}
                                            </span>
                                            {isPayable && (
                                                <button
                                                    onClick={() => handlePayInstalment(payment)}
                                                    disabled={loading}
                                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${isOverdue
                                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                                                        } disabled:opacity-50`}
                                                >
                                                    {loading && payingInstalmentId === payment.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <CreditCard className="w-3 h-3" />
                                                    )}
                                                    Pay Now
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Timeline connector */}
                                    {index < payments.length - 1 && (
                                        <div className="ml-4 mt-2 mb-[-16px]">
                                            <div className={`w-0.5 h-4 ${payment.status === 'paid' ? 'bg-green-200 dark:bg-green-500/20' : 'bg-gray-200 dark:bg-zinc-700'
                                                }`} />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Completed Notice */}
                {instalment.status === 'completed' && (
                    <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-2xl p-6 text-center mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                        <h3 className="font-bold text-green-800 dark:text-green-300 text-lg mb-1">All Payments Complete! 🎉</h3>
                        <p className="text-sm text-green-600 dark:text-green-400 mb-4">Your tickets have been issued and sent to your email.</p>
                        <Link
                            href="/my-tickets"
                            className="inline-block bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition-colors"
                        >
                            View My Tickets
                        </Link>
                    </div>
                )}

                {/* Forfeited Notice */}
                {instalment.status === 'forfeited' && (
                    <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6 text-center mb-4">
                        <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                        <h3 className="font-bold text-red-800 dark:text-red-300 text-lg mb-1">Plan Forfeited</h3>
                        <p className="text-sm text-red-600 dark:text-red-400">
                            This payment plan was forfeited due to missed payments. Contact the event organizer for refund inquiries.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
