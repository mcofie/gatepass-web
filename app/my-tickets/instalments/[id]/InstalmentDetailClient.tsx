'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, MapPin, Ticket as TicketIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'

interface PlanPayment {
    id: string
    instalment_number: number
    amount: number
    currency?: string | null
    status: 'pending' | 'paid' | 'overdue' | 'failed'
    due_at: string
    paid_at?: string | null
}

interface InstalmentDetail {
    id: string
    reservation_id: string
    total_amount: number
    amount_paid: number
    currency?: string | null
    status: 'active' | 'completed' | 'forfeited' | 'refunded'
    contact_email?: string | null
    instalment_payments?: PlanPayment[] | null
    reservations?: {
        guest_email?: string | null
        quantity?: number | null
        ticket_tiers?: { name: string } | null
        events?: {
            id: string
            title: string
            poster_url?: string | null
            starts_at: string
            ends_at?: string | null
            venue_name?: string | null
        } | null
    } | null
}

function displayTierName(name?: string) {
    if (!name) return 'General admission'
    if (/^virtual\s*\/\s*livestream\s*\/\s*online$/i.test(name)) return 'Livestream'
    if (/^pay[\s-]*what[\s-]*you[\s-]*want\s*\/\s*pay[\s-]*what[\s-]*you[\s-]*can$/i.test(name)) return 'Pay what you want'
    return name
}

function formatDate(value?: string | null) {
    if (!value) return ''
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' }).format(new Date(value))
}

function paymentLabel(payment: PlanPayment, now: number) {
    if (payment.status === 'paid') return 'Paid'
    if (payment.status === 'failed') return 'Failed'
    if (payment.status === 'overdue' || new Date(payment.due_at).getTime() < now) return 'Overdue'
    return 'Upcoming'
}

const primaryAction = 'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5] dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#080808]'
const secondaryAction = 'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#dedede] px-5 text-[13px] font-semibold text-[#222] transition-colors hover:border-[#aaa] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#383838] dark:text-white dark:hover:bg-[#202020] dark:focus-visible:ring-white'

export default function InstalmentDetailClient({ instalment }: { instalment: InstalmentDetail }) {
    const [processing, setProcessing] = useState<'next' | 'full' | null>(null)
    const reservation = instalment.reservations
    const event = reservation?.events
    const payments = [...(instalment.instalment_payments || [])].sort((a, b) => a.instalment_number - b.instalment_number)
    const currency = instalment.currency || 'GHS'
    const total = Number(instalment.total_amount) || 0
    const paid = Number(instalment.amount_paid) || 0
    const remaining = Math.max(0, total - paid)
    const progress = total > 0 ? Math.min(100, Math.max(0, Math.round((paid / total) * 100))) : 0
    const paidCount = payments.filter(payment => payment.status === 'paid').length
    const unpaidPayments = payments.filter(payment => payment.status === 'pending' || payment.status === 'overdue')
    const nextPayment = unpaidPayments[0]
    const now = Date.now()
    const eventStart = event ? new Date(event.starts_at).getTime() : 0
    const eventEnd = event?.ends_at ? new Date(event.ends_at).getTime() : eventStart + 4 * 60 * 60 * 1000
    const eventEnded = Boolean(event && eventEnd < now)
    const canPay = Boolean(event && !eventEnded && instalment.status === 'active' && remaining > 0 && nextPayment)
    const quantity = reservation?.quantity || 1
    const planStatus = instalment.status === 'active' ? 'Plan active' : instalment.status === 'completed' ? 'Paid in full' : instalment.status === 'forfeited' ? 'Forfeited' : 'Refunded'
    const displayStatus = eventEnded && instalment.status === 'active' ? 'Event ended' : planStatus

    const startPayment = async (kind: 'next' | 'full') => {
        if (!canPay || processing || !nextPayment) return
        if (eventEnd < Date.now()) {
            toast.error('This event has ended. Contact support about the remaining balance.')
            return
        }
        const email = instalment.contact_email || reservation?.guest_email
        if (!email) {
            toast.error('A contact email is needed to continue. Please contact support.')
            return
        }

        const payment = kind === 'next' ? nextPayment : null
        const amount = kind === 'next' ? Number(nextPayment.amount) : remaining
        const query = payment ? `instalment_payment_id=${payment.id}` : 'full_settlement=true'
        const callbackUrl = `${window.location.origin}${window.location.pathname}/payment-callback?${query}`
        setProcessing(kind)

        try {
            const response = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    amount: Math.round(amount * 100),
                    currency: payment?.currency || currency,
                    reservationIds: [instalment.reservation_id],
                    callbackUrl,
                    metadata: {
                        instalment_reservation_id: instalment.id,
                        ...(payment ? {
                            instalment_payment_id: payment.id,
                            instalment_number: payment.instalment_number,
                        } : { is_full_payment: true }),
                        payment_type: 'instalment',
                    },
                }),
            })
            const data = await response.json()
            if (!response.ok || !data.authorization_url) throw new Error(data.error || 'Could not start this payment')
            window.location.assign(data.authorization_url)
        } catch (error) {
            console.error('Instalment payment error:', error)
            toast.error(error instanceof Error ? error.message : 'Could not start this payment')
            setProcessing(null)
        }
    }

    return (
        <div>
            <Link href="/my-tickets" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#666] transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:text-[#aaa] dark:hover:text-white dark:focus-visible:ring-white">
                <ArrowLeft className="size-4" aria-hidden="true" />My tickets
            </Link>

            <div className="mb-8 mt-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#777] dark:text-[#aaa]">Payment plan</p>
                <h1 className="mt-2 text-[clamp(2.6rem,5vw,4rem)] font-semibold leading-[1.03] tracking-[-0.06em]">Plan details</h1>
                <p className="mt-3 text-[14px] text-[#666] dark:text-[#aaa]">Track your payments for {event?.title || 'your event'}.</p>
            </div>

            <section aria-labelledby="plan-event-title" className="overflow-hidden rounded-[20px] border border-[#e5e5e5] dark:border-[#303030]">
                <div className="flex items-center gap-4 border-b border-[#eaeaea] bg-[#fafafa] px-5 py-5 sm:px-7 dark:border-[#303030] dark:bg-[#111]">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#e9e9e9] dark:bg-[#222]">
                        {event?.poster_url ? <Image src={event.poster_url} alt="" fill className="object-cover" sizes="56px" /> : <TicketIcon className="absolute left-4 top-4 size-6 text-[#777]" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id="plan-event-title" className="text-[18px] font-semibold leading-6 tracking-[-0.035em] sm:text-[20px]">{event?.title || 'Event'}</h2>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#666] dark:text-[#aaa]">
                            {event?.starts_at && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden="true" />{formatDate(event.starts_at)}</span>}
                            {event?.venue_name && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{event.venue_name}</span>}
                        </p>
                        <p className="mt-1 text-[12px] text-[#777] dark:text-[#aaa]">{quantity} {quantity === 1 ? 'ticket' : 'tickets'} · {displayTierName(reservation?.ticket_tiers?.name)}</p>
                    </div>
                    <span className={`hidden shrink-0 items-center gap-1.5 text-[11px] font-medium sm:inline-flex ${instalment.status === 'forfeited' ? 'text-red-600 dark:text-red-400' : 'text-[#666] dark:text-[#aaa]'}`}><span className={`size-1.5 rounded-full ${instalment.status === 'forfeited' ? 'bg-red-500' : 'bg-[#111] dark:bg-white'}`} aria-hidden="true" />{displayStatus}</span>
                </div>

                <div className="px-5 py-6 sm:px-7 sm:py-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[13px] font-medium text-[#666] dark:text-[#aaa]">Remaining balance</p>
                            <p className="mt-1 text-[clamp(2.3rem,6vw,3.25rem)] font-semibold leading-none tracking-[-0.06em]">{formatCurrency(remaining, currency)}</p>
                        </div>
                        <span className="pt-1 text-[12px] font-medium text-[#777] sm:hidden dark:text-[#aaa]">{displayStatus}</span>
                    </div>

                    <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-[#e9e9e9] dark:bg-[#333]" role="progressbar" aria-label="Payment progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                        <div className="h-full rounded-full bg-[#111] dark:bg-white" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#666] dark:text-[#aaa]">
                        <span>{formatCurrency(paid, currency)} paid of {formatCurrency(total, currency)}</span>
                        <span>{progress}% paid</span>
                    </div>

                    {eventEnded && instalment.status === 'active' && remaining > 0 && (
                        <div className="mt-7 rounded-[14px] border border-[#e7e7e7] bg-[#fafafa] p-4 dark:border-[#333] dark:bg-[#1b1b1b]">
                            <p className="text-[14px] font-semibold">This event has ended</p>
                            <p className="mt-1 text-[13px] leading-5 text-[#666] dark:text-[#aaa]">The plan is still marked active, but further payments are unavailable here. Contact support before paying the remaining balance.</p>
                            <a href="mailto:support@gatepass.so" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white">Contact support <ArrowRight className="size-3.5" aria-hidden="true" /></a>
                        </div>
                    )}

                    {canPay && nextPayment && (
                        <div className="mt-7 border-t border-[#eaeaea] pt-6 dark:border-[#303030]">
                            <p className="mb-3 text-[12px] text-[#666] dark:text-[#aaa]">Payment {nextPayment.instalment_number} {paymentLabel(nextPayment, now) === 'Overdue' ? 'was due' : 'is due'} {formatDate(nextPayment.due_at)}.</p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button type="button" onClick={() => startPayment('next')} disabled={Boolean(processing)} className={`${primaryAction} sm:flex-1`}>
                                    {processing === 'next' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Pay next · {formatCurrency(Number(nextPayment.amount), nextPayment.currency || currency)}
                                </button>
                                {unpaidPayments.length > 1 && <button type="button" onClick={() => startPayment('full')} disabled={Boolean(processing)} className={`${secondaryAction} sm:flex-1`}>{processing === 'full' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Pay balance · {formatCurrency(remaining, currency)}</button>}
                            </div>
                        </div>
                    )}

                    {instalment.status === 'completed' && <Link href="/my-tickets" className={`${primaryAction} mt-7`}>View tickets <ArrowRight className="size-4" aria-hidden="true" /></Link>}
                    {instalment.status === 'forfeited' && <p className="mt-7 text-[13px] leading-5 text-[#666] dark:text-[#aaa]">This plan was forfeited. Contact support if you have questions about previous payments.</p>}
                    {instalment.status === 'refunded' && <p className="mt-7 text-[13px] leading-5 text-[#666] dark:text-[#aaa]">This plan has been refunded.</p>}
                </div>
            </section>

            <section aria-labelledby="payment-schedule-title" className="mt-6 overflow-hidden rounded-[20px] border border-[#e5e5e5] dark:border-[#303030]">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eaeaea] px-5 py-5 sm:px-7 dark:border-[#303030]">
                    <h2 id="payment-schedule-title" className="text-[20px] font-semibold tracking-[-0.04em]">Payment schedule</h2>
                    <span className="text-[12px] text-[#777] dark:text-[#aaa]">{paidCount} of {payments.length} paid</span>
                </div>
                {payments.length === 0 ? (
                    <p className="px-5 py-7 text-[13px] text-[#666] sm:px-7 dark:text-[#aaa]">The payment schedule is unavailable. Contact support for help.</p>
                ) : (
                    <ol className="divide-y divide-[#eaeaea] px-5 sm:px-7 dark:divide-[#303030]">
                        {payments.map(payment => {
                            const label = paymentLabel(payment, now)
                            const isNext = nextPayment?.id === payment.id && instalment.status === 'active'
                            return (
                                <li key={payment.id} className="flex items-start justify-between gap-4 py-4">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${payment.status === 'paid' ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-black' : 'border-[#dedede] text-[#777] dark:border-[#444] dark:text-[#aaa]'}`}>
                                            {payment.status === 'paid' ? <Check className="size-4" aria-hidden="true" /> : payment.instalment_number}
                                        </span>
                                        <div>
                                            <p className="text-[14px] font-semibold">Payment {payment.instalment_number}{isNext && !eventEnded ? <span className="ml-2 text-[11px] font-medium text-[#777] dark:text-[#aaa]">Next</span> : null}</p>
                                            <p className="mt-0.5 text-[12px] text-[#777] dark:text-[#aaa]">{payment.status === 'paid' ? `Paid ${formatDate(payment.paid_at || payment.due_at)}` : `Due ${formatDate(payment.due_at)}`}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-[14px] font-semibold">{formatCurrency(Number(payment.amount), payment.currency || currency)}</p>
                                        <p className={`mt-0.5 text-[11px] font-medium ${label === 'Overdue' || label === 'Failed' ? 'text-red-600 dark:text-red-400' : 'text-[#777] dark:text-[#aaa]'}`}>{label}</p>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                )}
            </section>
        </div>
    )
}
