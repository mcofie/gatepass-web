'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Check } from 'lucide-react'

export function LoginContent() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)

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

            setSent(true)
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

    if (sent) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black font-sans px-6 animate-in fade-in duration-700">
                <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mb-8 shadow-2xl">
                    <Check className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-white mb-4 text-center">Check your email</h2>
                <div className="text-lg text-gray-400 font-normal text-center max-w-sm mb-12">
                    We sent a login link to <br />
                    <span className="text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/20 pb-0.5">{email}</span>
                </div>

                <button
                    onClick={() => window.location.reload()}
                    className="text-sm font-medium text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                    Back to login
                </button>
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
                </form>
            </div>


        </div>
    )
}
