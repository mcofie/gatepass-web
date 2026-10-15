'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { listPayoutOptions, lookupPayoutAccount, setupManagedPayments } from '@/app/actions/managed-payments'
import type { PayoutBank } from '@/lib/payments/managed'
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/dashboard/ui'
import { cn } from '@/lib/utils'

/** Mobile money or bank payout details, confirmed with Paystack, then GatePass Payments is set up. */
export function PayoutAccountForm({ organizerId, currency, onCancel, onDone, submitLabel = 'Confirm and set up' }: { organizerId: string; currency: string; onCancel?: () => void; onDone: () => void; submitLabel?: string }) {
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
        <div className="space-y-5">
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
                {onCancel && <SecondaryButton type="button" size="sm" onClick={onCancel}>Cancel</SecondaryButton>}
                {accountName ? (
                    <PrimaryButton type="button" size="sm" loading={busy === 'save'} onClick={save}>{submitLabel}</PrimaryButton>
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
