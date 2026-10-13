'use client'

import React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CURRENCY_NAMES, getProvider } from '@/lib/integrations/providers'
import { setEventCurrency, setEventPaymentIntegration, type IntegrationSummary } from '@/app/actions/integrations'

const providerName = (id: string) => getProvider('payments', id)?.name ?? id

const selectClass = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-950 outline-none focus:border-gray-950 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/60'

/** Which provider this event charges through, and in which currency (limited to what that provider supports). */
export function EventPaymentProvider({ eventId, initialIntegrationId, initialCurrency, integrations }: {
    eventId: string
    initialIntegrationId: string | null
    initialCurrency: string
    integrations: IntegrationSummary[]
}) {
    const [selected, setSelected] = React.useState(initialIntegrationId ?? '')
    const [currency, setCurrency] = React.useState(initialCurrency.toUpperCase())
    const [saving, setSaving] = React.useState<null | 'provider' | 'currency'>(null)
    const defaultIntegration = integrations.find(i => i.isDefault)
    const active = selected ? integrations.find(i => i.id === selected) : defaultIntegration
    const provider = active ? getProvider('payments', active.provider) : undefined
    const currencies = provider?.currencies ?? Object.keys(CURRENCY_NAMES)
    const unsupported = !!provider?.currencies && !provider.currencies.includes(currency)

    const handleProvider = async (value: string) => {
        const previous = selected
        setSelected(value)
        setSaving('provider')
        try {
            await setEventPaymentIntegration(eventId, value || null)
            toast.success('Payment provider updated')
        } catch (e) {
            setSelected(previous)
            toast.error(e instanceof Error ? e.message : 'Could not update the payment provider')
        } finally {
            setSaving(null)
        }
    }

    const handleCurrency = async (value: string) => {
        const previous = currency
        setCurrency(value)
        setSaving('currency')
        try {
            await setEventCurrency(eventId, value)
            toast.success(`Prices are now in ${value}`)
        } catch (e) {
            setCurrency(previous)
            toast.error(e instanceof Error ? e.message : 'Could not change the currency')
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-950 dark:text-white">Payments</h3>
                {saving && <Loader2 className="size-4 animate-spin text-gray-400" aria-hidden="true" />}
            </div>

            {integrations.length === 0 ? (
                <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                    No payment provider connected.{' '}
                    <Link href="/dashboard/settings?tab=payments" className="font-medium text-gray-950 underline underline-offset-4 dark:text-white">Connect one in Settings</Link>
                </p>
            ) : (
                <div className="space-y-1.5">
                    <label htmlFor="event-payment-provider" className="text-sm font-medium text-gray-950 dark:text-white">Provider</label>
                    <select id="event-payment-provider" value={selected} disabled={!!saving} onChange={e => handleProvider(e.target.value)} className={selectClass}>
                        <option value="">Organization default{defaultIntegration ? ` (${providerName(defaultIntegration.provider)})` : ''}</option>
                        {integrations.map(i => (
                            <option key={i.id} value={i.id}>
                                {providerName(i.provider)}{i.mode === 'test' ? ' (test mode)' : ''}{i.status !== 'connected' ? ' · not verified' : ''}
                            </option>
                        ))}
                    </select>
                    {provider?.methods && <p className="text-xs text-gray-500 dark:text-gray-400">Buyers can pay with {provider.methods.join(', ').toLowerCase()}.</p>}
                </div>
            )}

            <div className="space-y-1.5">
                <label htmlFor="event-currency" className="text-sm font-medium text-gray-950 dark:text-white">Currency</label>
                <select id="event-currency" value={currency} disabled={!!saving} onChange={e => handleCurrency(e.target.value)} className={selectClass}>
                    {unsupported && <option value={currency}>{currency} (not supported)</option>}
                    {currencies.map(code => <option key={code} value={code}>{code} · {CURRENCY_NAMES[code] ?? code}</option>)}
                </select>
                {unsupported ? (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                        {provider?.name} can&apos;t charge in {currency}. Choose a supported currency or another provider before selling.
                    </p>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">All ticket prices for this event use this currency.</p>
                )}
            </div>
        </div>
    )
}
