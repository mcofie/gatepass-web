'use client'

import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, X } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { getEventBilling, payPlatformFee, type EventBillingSummary } from '@/app/actions/billing'

/** GatePass plan for this event: one-time fee by ticket capacity, plus the publish checklist. */
export function EventBillingCard({ eventId, capacityKey }: { eventId: string; capacityKey: string }) {
    const searchParams = useSearchParams()
    const [billing, setBilling] = React.useState<EventBillingSummary | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [paying, setPaying] = React.useState(false)

    // Reload whenever ticket capacity changes, since that decides the plan
    React.useEffect(() => {
        let cancelled = false
        getEventBilling(eventId)
            .then(result => { if (!cancelled) { setBilling(result); setError(null) } })
            .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load billing') })
        return () => { cancelled = true }
    }, [eventId, capacityKey])

    React.useEffect(() => {
        const status = searchParams.get('billing')
        if (status === 'paid') toast.success('Platform fee paid. You can publish this event.')
        else if (status === 'failed') toast.error('The platform fee payment was not completed.')
        else if (status === 'pending') toast.info('Your payment is still processing. Refresh in a moment.')
    }, [searchParams])

    const handlePay = async () => {
        setPaying(true)
        try {
            const { redirectUrl } = await payPlatformFee(eventId)
            window.location.assign(redirectUrl)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not start the payment')
            setPaying(false)
        }
    }

    if (error) return null

    return (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#0b0b0b]" aria-busy={!billing}>
            <h3 className="mb-4 text-base font-semibold text-gray-950 dark:text-white">GatePass plan</h3>

            {!billing ? (
                <Loader2 className="size-4 animate-spin text-gray-400" aria-label="Loading plan" />
            ) : (
                <div className="space-y-5">
                    <div>
                        <p className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">{billing.tierName ?? 'No plan'}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {billing.ticketCapacity >= 2147483647 ? 'Unlimited tickets' : `${billing.ticketCapacity.toLocaleString()} tickets`}
                            {billing.priceMinor > 0 ? ` · ${formatCurrency(billing.priceMinor / 100, billing.currency)} one-time` : ' · Free'}
                        </p>
                    </div>

                    <ul className="space-y-2.5 text-sm">
                        <ChecklistItem done={billing.covered} label={billing.covered ? 'Platform fee covered' : `Platform fee due: ${formatCurrency(billing.amountDueMinor / 100, billing.currency)}`} />
                        {billing.hasPaidTickets && (
                            <ChecklistItem
                                done={billing.hasPaymentProvider}
                                label={billing.hasPaymentProvider ? 'Payment provider connected' : 'Connect a payment provider'}
                                href={billing.hasPaymentProvider ? undefined : '/dashboard/settings'}
                            />
                        )}
                    </ul>

                    {!billing.covered && billing.amountDueMinor > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={handlePay}
                                disabled={paying}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gray-950 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
                            >
                                {paying && <Loader2 className="size-4 animate-spin" />}
                                Pay {formatCurrency(billing.amountDueMinor / 100, billing.currency)}
                            </button>
                            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                {billing.paidMinor > 0
                                    ? 'Your ticket capacity outgrew your plan. You only pay the difference.'
                                    : 'Paid once, before publishing. Ticket revenue goes straight to your own payment provider.'}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

function ChecklistItem({ done, label, href }: { done: boolean; label: string; href?: string }) {
    return (
        <li className="flex items-center gap-2.5">
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                {done ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
            </span>
            {href
                ? <Link href={href} className="font-medium text-gray-950 underline underline-offset-4 dark:text-white">{label}</Link>
                : <span className={done ? 'text-gray-700 dark:text-gray-300' : 'font-medium text-gray-950 dark:text-white'}>{label}</span>}
        </li>
    )
}
