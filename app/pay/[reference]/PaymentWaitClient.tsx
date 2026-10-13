'use client'

import React from 'react'
import { Loader2, Smartphone, XCircle } from 'lucide-react'

const POLL_MS = 3000
const TIMEOUT_MS = 3 * 60 * 1000

/** Shown while the buyer approves a push payment (M-Pesa STK) on their phone. */
export function PaymentWaitClient({ reference, returnUrl }: { reference: string; returnUrl: string }) {
    const [state, setState] = React.useState<'waiting' | 'failed' | 'timeout'>('waiting')
    const [message, setMessage] = React.useState<string | null>(null)

    React.useEffect(() => {
        // Only ever return to GatePass itself
        const safeReturn = returnUrl.startsWith(window.location.origin) || returnUrl.startsWith('/') ? returnUrl : '/'
        const started = Date.now()
        let timer: ReturnType<typeof setTimeout>

        const poll = async () => {
            try {
                const response = await fetch(`/api/payments/status?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' })
                const data = await response.json()
                if (data.status === 'success') {
                    window.location.replace(safeReturn)
                    return
                }
                if (data.status === 'failed') {
                    setState('failed')
                    setMessage(data.message)
                    return
                }
            } catch {
                // Network blip: keep polling
            }
            if (Date.now() - started > TIMEOUT_MS) {
                setState('timeout')
                return
            }
            timer = setTimeout(poll, POLL_MS)
        }

        timer = setTimeout(poll, POLL_MS)
        return () => clearTimeout(timer)
    }, [reference, returnUrl])

    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-white px-4 dark:bg-black">
            <div className="w-full max-w-sm text-center" role="status" aria-live="polite">
                {state === 'waiting' ? (
                    <>
                        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gray-950 text-white dark:bg-white dark:text-black">
                            <Smartphone className="size-6" aria-hidden="true" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Check your phone</h1>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Enter your M-Pesa PIN on the prompt we just sent. This page updates on its own.
                        </p>
                        <Loader2 className="mx-auto mt-8 size-5 animate-spin text-gray-400" aria-hidden="true" />
                    </>
                ) : (
                    <>
                        <XCircle className="mx-auto mb-6 size-12 text-red-500" aria-hidden="true" />
                        <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                            {state === 'failed' ? 'Payment not completed' : 'We didn’t hear back'}
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            {state === 'failed'
                                ? (message || 'The payment was cancelled or declined.')
                                : 'If you approved the payment, your tickets will arrive by email shortly. Otherwise, go back and try again.'}
                        </p>
                        <button type="button" onClick={() => window.history.back()} className="mt-8 inline-flex h-11 items-center rounded-full bg-gray-950 px-6 text-sm font-semibold text-white dark:bg-white dark:text-black">
                            Go back
                        </button>
                    </>
                )}
            </div>
        </main>
    )
}
