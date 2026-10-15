'use client'

import React, { useEffect, useState } from 'react'
import { getManagedPaymentsSetup, type ManagedPaymentsSetup } from '@/app/actions/managed-payments'
import { PrimaryButton, SecondaryButton } from '@/components/dashboard/ui'
import { PayoutAccountForm } from '@/components/payments/PayoutAccountForm'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { formatCurrency } from '@/utils/format'

/** "No keys needed": payouts to the organizer's bank or mobile money through GatePass's Paystack account. */
export function ManagedPaymentsCard({ organizerId, canEdit, onConnected }: { organizerId: string; canEdit: boolean; onConnected: () => void }) {
    const [setup, setSetup] = useState<ManagedPaymentsSetup | null>(null)
    const [editing, setEditing] = useState(false)

    useEffect(() => {
        let active = true
        getManagedPaymentsSetup(organizerId).then(s => active && setSetup(s)).catch(() => active && setSetup(null))
        return () => { active = false }
    }, [organizerId])

    if (!setup?.available) return null
    const { terms, account } = setup
    const money = (minor: number) => formatCurrency(minor / 100, setup.currency)

    return (
        <section aria-labelledby="gatepass-payments-heading" className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
                <div className="flex gap-4">
                    <GatePassMark className="size-11 shrink-0" />
                    <div>
                        <h3 id="gatepass-payments-heading" className="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">GatePass Payments</h3>
                        <p className="mt-1 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            {account
                                ? `Sales settle to ${account.bankName} · ${account.accountName} · ••••${account.accountNumberHint}.`
                                : 'No payment keys needed. Buyers pay by card or mobile money, and your share settles to your bank or mobile money the next business day.'}
                        </p>
                    </div>
                </div>
                {canEdit && !editing && (
                    account
                        ? <SecondaryButton type="button" size="sm" onClick={() => setEditing(true)}>Change payout account</SecondaryButton>
                        : <PrimaryButton type="button" size="sm" onClick={() => setEditing(true)}>Set up</PrimaryButton>
                )}
            </div>

            <dl className="grid grid-cols-1 gap-px border-t border-gray-100 bg-gray-100 text-sm dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
                <div className="bg-white p-5 dark:bg-[#0b0b0b] sm:px-7">
                    <dt className="text-gray-500 dark:text-gray-400">GatePass fee</dt>
                    <dd className="mt-1 font-semibold text-gray-950 dark:text-white">{terms.feePercent}% per paid ticket</dd>
                </div>
                <div className="bg-white p-5 dark:bg-[#0b0b0b] sm:px-7">
                    <dt className="text-gray-500 dark:text-gray-400">Payouts</dt>
                    <dd className="mt-1 font-semibold text-gray-950 dark:text-white">Next business day</dd>
                </div>
                <div className="bg-white p-5 dark:bg-[#0b0b0b] sm:px-7">
                    <dt className="text-gray-500 dark:text-gray-400">{account?.trustLevel === 'trusted' ? 'Holds' : 'New organizers'}</dt>
                    <dd className="mt-1 font-semibold text-gray-950 dark:text-white">
                        {account?.trustLevel === 'trusted' ? 'Nothing held' : `${terms.reservePercent}% held until ${terms.releaseHours}h after the event`}
                    </dd>
                </div>
            </dl>

            {account && setup.heldMinor > 0 && (
                <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400 sm:px-7">
                    {money(setup.heldMinor)} currently held. It’s paid to your account after each event ends.
                </p>
            )}

            {editing && (
                <div className="border-t border-gray-100 bg-gray-50/60 p-5 dark:border-white/10 dark:bg-white/[0.02] sm:p-7">
                    <PayoutAccountForm
                        organizerId={organizerId}
                        currency={setup.currency}
                        onCancel={() => setEditing(false)}
                        onDone={async () => {
                            setEditing(false)
                            setSetup(await getManagedPaymentsSetup(organizerId))
                            onConnected()
                        }}
                    />
                </div>
            )}

            <p className="border-t border-gray-100 px-5 py-4 text-xs leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400 sm:px-7">
                Paystack’s processing fee comes out of your share. Events on GatePass Payments don’t pay the one-time plan fee. Prefer to use your own account? Connect a provider below instead.
            </p>
        </section>
    )
}
