'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { getManagedPaymentsSetup, listPayoutOptions, lookupPayoutAccount, setupManagedPayments, type ManagedPaymentsSetup } from '@/app/actions/managed-payments'
import type { PayoutBank } from '@/lib/payments/managed'
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/dashboard/ui'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

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
                <SetupForm
                    organizerId={organizerId}
                    currency={setup.currency}
                    onCancel={() => setEditing(false)}
                    onDone={async () => {
                        setEditing(false)
                        setSetup(await getManagedPaymentsSetup(organizerId))
                        onConnected()
                    }}
                />
            )}

            <p className="border-t border-gray-100 px-5 py-4 text-xs leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400 sm:px-7">
                Paystack’s processing fee comes out of your share. Events on GatePass Payments don’t pay the one-time plan fee. Prefer to use your own account? Connect a provider below instead.
            </p>
        </section>
    )
}

function SetupForm({ organizerId, currency, onCancel, onDone }: { organizerId: string; currency: string; onCancel: () => void; onDone: () => void }) {
    const [kind, setKind] = useState<'mobile_money' | 'bank'>('mobile_money')
    const [banks, setBanks] = useState<PayoutBank[] | null>(null)
    const [bankCode, setBankCode] = useState('')
    const [accountNumber, setAccountNumber] = useState('')
    const [accountName, setAccountName] = useState<string | null>(null)
    const [busy, setBusy] = useState<null | 'lookup' | 'save'>(null)

    useEffect(() => {
        let active = true
        listPayoutOptions(organizerId, kind)
            .then(list => { if (active) { setBanks(list); setBankCode('') } })
            .catch(e => { if (active) { setBanks([]); toast.error(e instanceof Error ? e.message : 'Could not load the list') } })
        return () => { active = false }
    }, [organizerId, kind])

    const lookup = async () => {
        setBusy('lookup')
        setAccountName(null)
        try {
            setAccountName((await lookupPayoutAccount(organizerId, bankCode, accountNumber)).accountName)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'We couldn’t confirm that account')
        } finally {
            setBusy(null)
        }
    }

    const save = async () => {
        setBusy('save')
        try {
            await setupManagedPayments(organizerId, { kind, bankCode, accountNumber })
            toast.success('GatePass Payments is ready')
            onDone()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not finish setup')
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="space-y-5 border-t border-gray-100 bg-gray-50/60 p-5 dark:border-white/10 dark:bg-white/[0.02] sm:p-7">
            <div role="radiogroup" aria-label="Payout method" className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-[#0b0b0b]">
                {([['mobile_money', 'Mobile money'], ['bank', 'Bank account']] as const).map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => { setKind(id); setAccountName(null) }} className={cn('h-9 rounded-full px-4 text-sm font-medium transition-colors', kind === id ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white')}>
                        {label}
                    </button>
                ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={kind === 'mobile_money' ? 'Network' : 'Bank'} htmlFor="payout-bank">
                    <select id="payout-bank" value={bankCode} onChange={e => { setBankCode(e.target.value); setAccountName(null) }} disabled={!banks} className={inputClass}>
                        <option value="">{banks ? 'Choose…' : 'Loading…'}</option>
                        {banks?.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                </Field>
                <Field label={kind === 'mobile_money' ? 'Mobile money number' : 'Account number'} htmlFor="payout-number" hint={`Payouts are in ${currency}.`}>
                    <input id="payout-number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={e => { setAccountNumber(e.target.value); setAccountName(null) }} onBlur={() => bankCode && accountNumber.length >= 6 && !accountName && lookup()} className={inputClass} placeholder={kind === 'mobile_money' ? '024 000 0000' : 'Account number'} />
                </Field>
            </div>

            {accountName ? (
                <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm dark:bg-[#0b0b0b]">
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                    <span className="text-gray-500 dark:text-gray-400">Account name</span>
                    <strong className="font-semibold text-gray-950 dark:text-white">{accountName}</strong>
                </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
                <SecondaryButton type="button" size="sm" onClick={onCancel}>Cancel</SecondaryButton>
                {accountName ? (
                    <PrimaryButton type="button" size="sm" loading={busy === 'save'} onClick={save}>Confirm and set up</PrimaryButton>
                ) : (
                    <PrimaryButton type="button" size="sm" disabled={!bankCode || accountNumber.replace(/\D/g, '').length < 6} loading={busy === 'lookup'} onClick={lookup}>
                        {busy === 'lookup' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                        Check account
                    </PrimaryButton>
                )}
            </div>
        </div>
    )
}
