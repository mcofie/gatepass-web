'use client'

import React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { PROVIDERS } from '@/lib/integrations/providers'
import { setEventPaymentIntegration, type IntegrationSummary } from '@/app/actions/integrations'

const providerName = (id: string) => PROVIDERS.find(p => p.category === 'payments' && p.id === id)?.name ?? id

export function EventPaymentProvider({ eventId, initialIntegrationId, integrations }: {
    eventId: string
    initialIntegrationId: string | null
    integrations: IntegrationSummary[]
}) {
    const [selected, setSelected] = React.useState(initialIntegrationId ?? '')
    const [saving, setSaving] = React.useState(false)
    const defaultIntegration = integrations.find(i => i.isDefault)

    const handleChange = async (value: string) => {
        const previous = selected
        setSelected(value)
        setSaving(true)
        try {
            await setEventPaymentIntegration(eventId, value || null)
            toast.success('Payment provider updated')
        } catch (e) {
            setSelected(previous)
            toast.error(e instanceof Error ? e.message : 'Could not update the payment provider')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
            <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-950 dark:text-white">Payment provider</h3>
                {saving && <Loader2 className="size-4 animate-spin text-gray-400" aria-hidden="true" />}
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Ticket revenue for this event is paid straight into this account.</p>

            {integrations.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                    No payment provider connected.{' '}
                    <Link href="/dashboard/settings" className="font-medium text-gray-950 underline underline-offset-4 dark:text-white">Connect one in Settings</Link>
                </p>
            ) : (
                <>
                    <label htmlFor="event-payment-provider" className="sr-only">Payment provider for this event</label>
                    <select
                        id="event-payment-provider"
                        value={selected}
                        disabled={saving}
                        onChange={e => handleChange(e.target.value)}
                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-950 outline-none focus:border-gray-950 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/60"
                    >
                        <option value="">
                            Organization default{defaultIntegration ? ` (${providerName(defaultIntegration.provider)})` : ''}
                        </option>
                        {integrations.map(i => (
                            <option key={i.id} value={i.id}>
                                {providerName(i.provider)}{i.mode === 'test' ? ' (test mode)' : ''}{i.status !== 'connected' ? ' · not verified' : ''}
                            </option>
                        ))}
                    </select>
                </>
            )}
        </div>
    )
}
