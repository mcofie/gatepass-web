'use client'

import React, { useState } from 'react'
import { Check, Clock, Copy, Lock, X } from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { getProvider } from '@/lib/integrations/providers'

export type PaymentReturnState =
    | { phase: 'checking' | 'pending'; reference: string }
    | { phase: 'failed' | 'timeout'; reference: string; message?: string | null }

/**
 * Full-screen state for the moment a buyer comes back from the payment provider:
 * confirming, still processing (mobile money can take a minute), or not completed.
 */
export function PaymentReturn({ state, eventTitle, providerId, onRetry }: {
    state: PaymentReturnState
    eventTitle: string
    providerId?: string | null
    onRetry: () => void
}) {
    const provider = providerId ? getProvider('payments', providerId) : undefined
    const providerName = provider?.name ?? 'your payment provider'
    const [copied, setCopied] = useState(false)
    const working = state.phase === 'checking' || state.phase === 'pending'

    const copyReference = async () => {
        try {
            await navigator.clipboard.writeText(state.reference)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            // Clipboard blocked: the reference is still visible on screen
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white text-gray-950 animate-fade-in dark:bg-[#080808] dark:text-white" role="status" aria-live="polite">
            <div className="flex items-center justify-center gap-2 pt-8 text-sm font-semibold text-gray-400">
                <GatePassMark className="size-5 opacity-60" /> GatePass
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                {working ? (
                    <div className="relative size-16" aria-hidden="true">
                        <div className="absolute inset-0 rounded-full border-[3px] border-gray-100 dark:border-white/10" />
                        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-gray-950 dark:border-t-white" />
                        {provider && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/brands/${provider.id}.png`} alt="" className="absolute inset-[18px] size-7 rounded-lg object-contain" />
                        )}
                    </div>
                ) : (
                    <div className="flex size-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                        {state.phase === 'timeout' ? <Clock className="size-7" strokeWidth={2} /> : <X className="size-7" strokeWidth={2.2} />}
                    </div>
                )}

                <p className="mt-7 text-sm text-gray-500 dark:text-gray-400">{eventTitle}</p>
                <h1 className="mt-1 max-w-sm text-[28px] font-semibold leading-tight tracking-[-0.04em]">
                    {state.phase === 'checking' && 'Confirming your payment'}
                    {state.phase === 'pending' && 'Still confirming'}
                    {state.phase === 'failed' && 'Payment didn’t go through'}
                    {state.phase === 'timeout' && 'We’re still waiting'}
                </h1>
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {state.phase === 'checking' && `Checking with ${providerName}. This usually takes a few seconds.`}
                    {state.phase === 'pending' && `${providerName} hasn’t confirmed it yet. If you paid with mobile money, approve the prompt on your phone. This page updates on its own.`}
                    {state.phase === 'failed' && (state.message || 'The payment was cancelled or declined.')}
                    {state.phase === 'timeout' && 'If you approved the payment, your tickets will arrive by email once it clears. You can also check My tickets in a few minutes.'}
                </p>

                {working ? (
                    <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-gray-400">
                        <Lock className="size-3" aria-hidden="true" /> Keep this page open
                    </p>
                ) : (
                    <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
                        <button type="button" onClick={onRetry} className="h-12 rounded-full bg-gray-950 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black">
                            {state.phase === 'failed' ? 'Try again' : 'Back to the event'}
                        </button>
                        {state.phase === 'timeout' && (
                            <a href="/my-tickets" className="flex h-12 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold transition-colors hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/5">My tickets</a>
                        )}
                    </div>
                )}
            </div>

            {!working && (
                <div className="space-y-2 px-6 pb-8 text-center text-xs text-gray-400">
                    <p>Need help? Email <a href={`mailto:support@gatepass.so?subject=${encodeURIComponent(`Payment ${state.reference}`)}`} className="font-medium text-gray-950 underline underline-offset-2 dark:text-white">support@gatepass.so</a> with your reference</p>
                    <button type="button" onClick={copyReference} aria-label="Copy payment reference" className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {state.reference.slice(0, 14)}{copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
                    </button>
                </div>
            )}
        </div>
    )
}
