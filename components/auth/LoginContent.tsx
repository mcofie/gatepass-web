'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'

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
            toast.success('Magic link sent to your email!')
        } catch (error: any) {
            console.error('Magic Link Error:', error)

            if (error.message?.includes('Error sending magic link email') || error.code === 'unexpected_failure') {
                toast.error('Failed to send email. You may have hit the rate limit (3/hour). Please wait or check your Supabase logs.')
            } else {
                toast.error(error.message)
            }
        } finally {
            setLoading(false)
        }
    }

    if (sent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
                <div className="max-w-[400px] w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                        <Mail className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Check your email</h3>
                    <p className="text-gray-500 mb-8 text-sm">
                        We've sent a magic login link to <span className="font-bold text-gray-900">{email}</span>.
                    </p>
                    <button
                        onClick={() => setSent(false)}
                        className="text-sm font-bold text-gray-400 hover:text-black transition-colors"
                    >
                        Try different email
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
            {/* Main Content */}
            <div className="max-w-[400px] w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black tracking-tight mb-2">Welcome Back</h1>
                    <p className="text-gray-500 text-sm">Enter your email to sign in or create an account.</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-900 ml-1">Email Address</label>
                            <Input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                type="email"
                                required
                                placeholder="name@company.com"
                                className="h-12 bg-gray-50 border-gray-200 text-black placeholder:text-gray-400 focus:bg-white focus:border-black focus:ring-black/5 rounded-xl transition-all"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-black text-white hover:bg-gray-800 font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Sending Link...
                                </span>
                            ) : (
                                'Continue with Email'
                            )}
                        </Button>
                    </form>
                </div>

                <div className="mt-8 text-center text-xs text-gray-400">
                    &copy; 2025 Gatepass Inc.
                </div>
            </div>
        </div>
    )
}
