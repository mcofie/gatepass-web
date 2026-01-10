'use client'

import React, { useState } from 'react'
import { X, Bell, Loader2, CheckCircle2 } from 'lucide-react'
import { joinWaitlist } from '@/app/actions/waitlist'

interface WaitlistModalProps {
    isOpen: boolean
    onClose: () => void
    eventId: string
    tierId: string
    tierName: string
}

export function WaitlistModal({ isOpen, onClose, eventId, tierId, tierName }: WaitlistModalProps) {
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const result = await joinWaitlist(eventId, tierId, email, name)

        if (result.error) {
            setError(result.error)
        } else {
            setSuccess(true)
        }

        setLoading(false)
    }

    const handleClose = () => {
        setEmail('')
        setName('')
        setSuccess(false)
        setError('')
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white dark:bg-[#111] rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 fade-in duration-200">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                {success ? (
                    <div className="text-center py-6">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You&apos;re on the list!</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            We&apos;ll notify you at <strong>{email}</strong> when more tickets become available.
                        </p>
                        <button
                            onClick={handleClose}
                            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Bell className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Join the Waitlist</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                <strong>{tierName}</strong> tickets are sold out. Get notified when more become available.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none"
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none"
                                    placeholder="you@example.com"
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 text-center">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Bell className="w-4 h-4" />
                                        Notify Me
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
