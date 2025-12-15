'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'

export function LoginContent() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect') || '/'
    const supabase = createClient()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const { error } = isSignUp
            ? await supabase.auth.signUp({
                email,
                password,
            })
            : await supabase.auth.signInWithPassword({
                email,
                password,
            })

        if (error) {
            toast.error(error.message)
        } else {
            router.push(redirect)
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
            {/* Main Content */}
            <div className="max-w-[400px] w-full">


                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <form onSubmit={handleAuth} className="space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-semibold text-gray-900">Email</label>
                                <Input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    required
                                    placeholder="name@example.com"
                                    className="h-11 bg-white border-gray-200 text-black placeholder:text-gray-400 focus:border-black focus:ring-black/5 rounded-lg transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[13px] font-semibold text-gray-900">Password</label>
                                <Input
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="h-11 bg-white border-gray-200 text-black placeholder:text-gray-400 focus:border-black focus:ring-black/5 rounded-lg transition-all"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-black text-white hover:bg-gray-800 font-semibold rounded-lg transition-all active:scale-[0.98] shadow-sm"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Processing...
                                </span>
                            ) : (
                                isSignUp ? 'Create Account' : 'Sign In'
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-[14px] text-gray-500 hover:text-black transition-colors font-medium"
                    >
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <span className="text-black font-semibold ml-1 hover:underline underline-offset-4">
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </span>
                    </button>

                    <div className="mt-8 text-xs text-gray-400">
                        &copy; 2025 Gatepass Inc.
                    </div>
                </div>
            </div>
        </div>
    )
}
