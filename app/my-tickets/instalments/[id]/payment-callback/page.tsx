'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, PartyPopper } from 'lucide-react'

function PaymentCallbackContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<'loading' | 'success' | 'completed' | 'error'>('loading')
    const [message, setMessage] = useState('')
    const [instalmentReservationId, setInstalmentReservationId] = useState<string>('')

    useEffect(() => {
        const processCallback = async () => {
            const { id } = await paramsPromise
            setInstalmentReservationId(id)
            const reference = searchParams.get('reference') || searchParams.get('trxref')
            const instalmentPaymentId = searchParams.get('instalment_payment_id')

            if (!reference || !instalmentPaymentId) {
                setStatus('error')
                setMessage('Missing payment information.')
                return
            }

            try {
                const response = await fetch('/api/paystack/pay-instalment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference, instalmentPaymentId })
                })

                const data = await response.json()

                if (!response.ok || !data.success) {
                    setStatus('error')
                    setMessage(data.error || 'Payment verification failed')
                    return
                }

                // Check if tickets were issued (final payment)
                if (data.tickets && data.tickets.length > 0) {
                    setStatus('completed')
                    setMessage('All payments complete! Your tickets have been issued! 🎉')
                } else {
                    setStatus('success')
                    setMessage(data.message || 'Payment received!')
                }

                // Redirect back to detail page after 3s
                setTimeout(() => {
                    if (data.tickets && data.tickets.length > 0) {
                        router.push('/my-tickets')
                    } else {
                        router.push(`/my-tickets/instalments/${id}`)
                    }
                }, 3000)
            } catch (error: any) {
                setStatus('error')
                setMessage(error.message || 'Something went wrong')
            }
        }

        processCallback()
    }, [searchParams, router, paramsPromise])

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
                            <p className="text-sm text-gray-500">Verifying your instalment payment</p>
                        </div>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment Received! ✅</h1>
                            <p className="text-sm text-gray-500">{message}</p>
                        </div>
                        <p className="text-xs text-gray-400">Redirecting to your payment plan...</p>
                    </>
                )}

                {status === 'completed' && (
                    <>
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center animate-in zoom-in duration-500 shadow-lg shadow-green-500/20">
                            <PartyPopper className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">All Done! 🎉</h1>
                            <p className="text-sm text-gray-500">{message}</p>
                        </div>
                        <p className="text-xs text-gray-400">Redirecting to your tickets...</p>
                        <button
                            onClick={() => router.push('/my-tickets')}
                            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                        >
                            View My Tickets
                        </button>
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
                            onClick={() => router.push(`/my-tickets/instalments/${instalmentReservationId}`)}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                            Back to Payment Plan
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default function InstalmentPaymentCallbackPage({ params }: { params: Promise<{ id: string }> }) {
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
            <PaymentCallbackContent paramsPromise={params} />
        </Suspense>
    )
}
