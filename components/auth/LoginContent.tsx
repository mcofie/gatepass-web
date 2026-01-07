'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Check, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'

export function LoginContent() {
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [view, setView] = useState<'LOGIN' | 'SENT' | 'MANUAL'>('LOGIN')
    const searchParams = useSearchParams()
    const nextPath = searchParams.get('next') || ''
    const router = useRouter() // Though we use window.location for full reload often, consistency helps.

    const supabase = createClient()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Determine the base URL: prefer env var, fallback to origin
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
                ? process.env.NEXT_PUBLIC_SITE_URL
                : window.location.origin

            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    shouldCreateUser: true,
                    // Pass 'next' to the callback route
                    emailRedirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
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
        if (!email && view === 'MANUAL') {
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

            // Hard reload to refresh session state and go to next path
            if (nextPath) {
                window.location.href = nextPath
            } else {
                // If no next path, hit the callback to let server decide (dashboard vs my-tickets)
                window.location.href = '/auth/callback'
            }
        } catch (error: any) {
            console.error('OTP Verification Error:', error)
            toast.error(error.message || 'Invalid code')
        } finally {
            setVerifying(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] dark:bg-[#050505] font-sans px-6 relative overflow-hidden">
            {/* Subtle Textured Background */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 dark:brightness-100" />
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-[380px] z-10">
                {/* Logo Area */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex justify-center mb-12"
                >
                    <div className="w-12 h-12 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-xl shadow-black/5 dark:shadow-white/5">
                        <span className="font-bold text-white dark:text-black text-lg tracking-tighter">GP</span>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {view === 'LOGIN' && (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="text-center mb-10">
                                <h1 className="text-3xl font-semibold text-black dark:text-white tracking-tight mb-3">Sign in</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-[15px]">Welcome back to GatePass.</p>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-6">
                                <div className="space-y-2">
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        type="email"
                                        required
                                        placeholder="name@work.com"
                                        className="w-full h-14 bg-gray-50 dark:bg-zinc-900/50 border-none rounded-2xl px-5 text-lg font-medium text-center text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 transition-all outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-14 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[16px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-black/10 dark:shadow-white/10 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Continue <ArrowRight className="w-4 h-4 opacity-50" />
                                        </>
                                    )}
                                </button>

                                <div className="pt-4 text-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // if (email) setExpectedEmail(email) // Optional: pass state logic eventually
                                            setView('MANUAL')
                                        }}
                                        className="text-[13px] font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                    >
                                        I have a code
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {view === 'SENT' && (
                        <motion.div
                            key="sent"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col items-center"
                        >
                            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-zinc-900 flex items-center justify-center mb-8 border border-gray-100 dark:border-zinc-800">
                                <Check className="w-8 h-8 text-black dark:text-white" />
                            </div>
                            <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-white mb-4 text-center">Check your email</h2>
                            <div className="text-[15px] text-gray-500 dark:text-gray-400 text-center max-w-xs mb-10 leading-relaxed">
                                We sent a login link and code to <br />
                                <span className="text-black dark:text-white font-medium">{email}</span>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="w-full space-y-6">
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-100 dark:border-zinc-800"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-[#FDFDFD] dark:bg-[#050505] px-4 text-gray-400 tracking-widest font-medium">Or enter code</span>
                                    </div>
                                </div>

                                <input
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="000 000"
                                    className="w-full h-16 bg-transparent border-b-2 border-gray-100 dark:border-zinc-800 focus:border-black dark:focus:border-white rounded-none text-center text-3xl font-mono tracking-[0.5em] text-black dark:text-white placeholder:text-gray-200 dark:placeholder:text-zinc-800 outline-none transition-all"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={verifying || otp.length < 6}
                                    className="w-full h-14 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[16px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-black/10 dark:shadow-white/10 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    {verifying ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Verify Code'
                                    )}
                                </button>
                            </form>

                            <button
                                onClick={() => {
                                    setView('LOGIN')
                                    setOtp('')
                                }}
                                className="mt-8 flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back to login
                            </button>
                        </motion.div>
                    )}

                    {view === 'MANUAL' && (
                        <motion.div
                            key="manual"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="text-center mb-10">
                                <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight mb-3">Login Code</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-[15px]">Enter the 6-digit code sent to your email.</p>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Email</label>
                                        <input
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            type="email"
                                            required
                                            placeholder="name@work.com"
                                            className="w-full h-12 bg-gray-50 dark:bg-zinc-900/50 border-none rounded-xl px-4 text-base font-medium text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-1 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Code</label>
                                        <input
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="000 000"
                                            className="w-full h-14 bg-gray-50 dark:bg-zinc-900/50 border-none rounded-xl text-center text-xl font-mono tracking-[0.5em] text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-1 focus:ring-black dark:focus:ring-white transition-all outline-none"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={verifying || otp.length < 6 || !email}
                                    className="w-full h-14 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[16px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-black/10 dark:shadow-white/10 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    {verifying ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Verify Code'
                                    )}
                                </button>
                            </form>

                            <div className="text-center mt-8">
                                <button
                                    onClick={() => setView('LOGIN')}
                                    className="flex items-center justify-center gap-2 text-[13px] font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors w-full"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back to login
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
