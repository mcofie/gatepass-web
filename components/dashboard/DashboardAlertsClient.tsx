'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

interface DashboardAlertsClientProps {
    needsPayments: boolean
    needsSetup: boolean
    missingOrg: boolean
    missingProfile: boolean
}

export function DashboardAlertsClient({ needsPayments, needsSetup, missingOrg, missingProfile }: DashboardAlertsClientProps) {
    const [expanded, setExpanded] = useState(needsPayments)
    const count = Number(needsPayments) + Number(needsSetup)
    if (!count) return null

    const missingDetails = [missingOrg && 'organization details', missingProfile && 'your profile'].filter(Boolean).join(' and ')

    return (
        <section className="mx-auto mb-8 max-w-[1180px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/15 dark:bg-[#101010]" aria-label="Setup checklist">
            <button type="button" aria-expanded={expanded} onClick={() => setExpanded(open => !open)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5 sm:px-6">
                <span className="flex min-w-0 items-center gap-3">
                    <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    <span className="text-sm font-semibold text-gray-950 dark:text-white">Finish your setup</span>
                    <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">{count} {count === 1 ? 'item' : 'items'} to review</span>
                </span>
                <ChevronDown className={'size-4 shrink-0 text-gray-500 transition-transform ' + (expanded ? 'rotate-180' : '')} aria-hidden="true" />
            </button>
            {expanded && (
                <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-white/10 dark:border-white/10">
                    {needsPayments && <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div><h3 className="text-sm font-semibold text-gray-950 dark:text-white">Connect a payment provider</h3><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Ticket revenue is paid straight into your own Stripe, Paystack, Flutterwave, Hubtel, M-Pesa or Wave account.</p></div>
                        <Link href="/dashboard/settings" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-950 hover:underline dark:text-white">Open settings <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
                    </div>}
                    {needsSetup && <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div><h3 className="text-sm font-semibold text-gray-950 dark:text-white">Complete your details</h3><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Add {missingDetails} so your workspace is ready.</p></div>
                        <Link href="/dashboard/settings" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-950 hover:underline dark:text-white">Open settings <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
                    </div>}
                </div>
            )}
        </section>
    )
}
