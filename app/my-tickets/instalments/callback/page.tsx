'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

function InstalmentCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')
    const [instalmentId, setInstalmentId] = useState<string | null>(null)

    useEffect(() => {
        const processCallback = async () => {
            const reference = searchParams.get('reference') || searchParams.get('trxref')
            const planId = searchParams.get('plan_id')
            const reservationId = searchParams.get('reservation_id')

            if (!reference || !planId || !reservationId) {
                setStatus('error')
                setMessage('Missing payment information. Please try again.')
                return
            }

            try {
                const response = await fetch('/api/paystack/verify-instalment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference, reservationId, paymentPlanId: planId })
                })

                const data = await response.json()

                if (!response.ok || !data.success) {
                    setStatus('error')
                    setMessage(data.error || 'Payment verification failed')
                    return
                }

                setStatus('success')
                setMessage(data.message || 'Instalment plan activated!')
                setInstalmentId(data.instalmentReservation?.id)

                // Redirect to instalment detail after 3s
                setTimeout(() => {
                    if (data.instalmentReservation?.id) {
                        router.push(`/my-tickets/instalments/${data.instalmentReservation.id}`)
                    } else {
                        router.push('/my-tickets/instalments')
                    }
                }, 3000)
            } catch (error: any) {
                setStatus('error')
                setMessage(error.message || 'Something went wrong')
            }
        }

        processCallback()
    }, [searchParams, router])

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-6">
                {status === 'loading' && (
                    <>
                        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Processing Payment...</h1>
                            <p className="text-sm text-gray-500">Setting up your instalment plan</p>
                        </div>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Plan Activated! 🎉</h1>
                            <p className="text-sm text-gray-500">{message}</p>
                        </div>
                        <p className="text-xs text-gray-400">Redirecting to your payment plan...</p>
                        {instalmentId && (
                            <button
                                onClick={() => router.push(`/my-tickets/instalments/${instalmentId}`)}
                                className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                            >
                                View Payment Plan
                            </button>
                        )}
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something Went Wrong</h1>
                            <p className="text-sm text-red-500">{message}</p>
                        </div>
                        <button
                            onClick={() => router.push('/my-tickets')}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                            Go to My Tickets
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default function InstalmentCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-6">
                    <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Processing Payment...</h1>
                </div>
            </div>
        }>
            <InstalmentCallbackContent />
        </Suspense>
    )
}
