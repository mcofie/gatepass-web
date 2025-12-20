'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Check } from 'lucide-react'

export function LoginContent() {
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [view, setView] = useState<'LOGIN' | 'SENT' | 'MANUAL'>('LOGIN')

    const supabase = createClient()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            })

            if (error) throw error

            setView('SENT')
            toast.success('Magic link sent!')
        } catch (error: any) {
            console.error('Magic Link Error:', error)
            if (error.message?.includes('Error sending magic link email') || error.code === 'unexpected_failure') {
                toast.error('Failed to send email. Rate limit exceeded.')
            } else {
                toast.error(error.message)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!otp || otp.length < 6) {
            toast.error('Please enter a valid 6-digit code')
            return
        }
        if (!email) {
            toast.error('Please enter your email')
            return
        }

        setVerifying(true)
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp,
                type: 'email',
            })

            if (error) throw error

            toast.success('Logged in successfully!')
            // Hard reload to refresh session state
            window.location.href = '/dashboard'
        } catch (error: any) {
            console.error('OTP Verification Error:', error)
            toast.error(error.message || 'Invalid code')
        } finally {
            setVerifying(false)
        }
    }

    if (view === 'SENT') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black font-sans px-6 animate-in fade-in duration-700">
                <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mb-8 shadow-2xl">
                    <Check className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-white mb-4 text-center">Check your email</h2>
                <div className="text-lg text-gray-400 font-normal text-center max-w-sm mb-8">
                    We sent a login link and code to <br />
                    <span className="text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/20 pb-0.5">{email}</span>
                </div>

                <div className="w-full max-w-[360px] space-y-6">
                    <div className="relative flex items-center gap-4">
                        <div className="h-px bg-gray-200 dark:bg-white/10 flex-1" />
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Or enter code</span>
                        <div className="h-px bg-gray-200 dark:bg-white/10 flex-1" />
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            type="text"
                            inputMode="numeric"
                            placeholder="000 000"
                            className="w-full h-14 bg-gray-50 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-none transition-all"
                        />
                        <button
                            type="submit"
                            disabled={verifying || otp.length < 6}
                            className="w-full h-12 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[15px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/5 dark:shadow-white/5 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {verifying ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Verify Code'
                            )}
                        </button>
                    </form>
                </div>

                <button
                    onClick={() => {
                        setView('LOGIN')
                        setOtp('')
                    }}
                    className="mt-8 text-sm font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                    Back to login
                </button>
            </div>
        )
    }

    if (view === 'MANUAL') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black font-sans px-6 animate-in fade-in duration-700">
                <div className="w-full max-w-[360px] space-y-8">
                    <div className="text-center">
                        <h2 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-white mb-2">Enter Login Code</h2>
                        <p className="text-gray-400">Enter the 6-digit code sent to your email.</p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    required
                                    placeholder="name@work.com"
                                    className="w-full h-12 bg-gray-50 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white rounded-xl px-4 text-base font-medium text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2 ml-1">Code</label>
                                <input
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="000 000"
                                    className="w-full h-14 bg-gray-50 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={verifying || otp.length < 6 || !email}
                            className="w-full h-12 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[15px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/5 dark:shadow-white/5 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {verifying ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Verify Code'
                            )}
                        </button>
                    </form>

                    <div className="text-center">
                        <button
                            onClick={() => setView('LOGIN')}
                            className="text-sm font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black font-sans px-6">

            <div className="w-full max-w-[360px] animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Logo Area */}
                <div className="flex justify-center mb-16">
                    <div className="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center shadow-lg">
                        <span className="font-bold text-white dark:text-black text-sm tracking-tighter">GP</span>
                    </div>
                </div>

                <div className="mb-12 text-center">
                    <h1 className="text-2xl font-medium text-gray-900 dark:text-white tracking-tight mb-2">Sign in to GatePass</h1>
                    <p className="text-gray-400 text-[15px]">Welcome back, creator.</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="group relative">
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            required
                            placeholder="name@work.com"
                            className="w-full h-12 bg-transparent border-b border-gray-200 dark:border-white/10 text-lg font-medium text-center text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-700 focus:outline-none focus:border-black dark:focus:border-white transition-colors rounded-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 mt-8 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[15px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/5 dark:shadow-white/5 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                Continue <ArrowRight className="w-4 h-4 opacity-50" />
                            </>
                        )}
                    </button>

                    <div className="pt-4 text-center">
                        <button
                            type="button"
                            onClick={() => setView('MANUAL')}
                            className="text-xs font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                            I have a code
                        </button>
                    </div>
                </form>
            </div>


        </div>
    )
}
