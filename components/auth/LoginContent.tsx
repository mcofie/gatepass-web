'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
            alert(error.message)
        } else {
            router.push(redirect)
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2">
            {/* Left Column: Visuals */}
            <div className="relative flex flex-col justify-between p-6 md:p-12 bg-black text-white overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 shrink-0">
                {/* Animated Background */}
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[4s]"></div>
                    <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-1000 duration-[5s]"></div>
                    <div className="absolute bottom-[-10%] left-[30%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] mix-blend-screen animate-pulse delay-2000 duration-[7s]"></div>
                </div>

                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_90%)] z-0"></div>

                {/* Brand */}
                <div className="relative z-10 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 bg-black rounded-sm"></div>
                    </div>
                    <span className="font-bold text-xl tracking-tight">Gatepass.</span>
                </div>

                {/* Hero Text */}
                <div className="relative z-10 space-y-6 my-12 lg:my-0 max-w-lg">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 animate-slide-up">
                        Access the most exclusive events.
                    </h1>
                    <p className="text-lg text-gray-400 font-light max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        Join the community of curators, creators, and attendees shaping the future of experiences.
                    </p>
                </div>

                {/* Footer */}
                <div className="relative z-10 hidden lg:block text-xs text-gray-500 uppercase tracking-widest">
                    &copy; 2025 Gatepass Inc.
                </div>
            </div>

            {/* Right Column: Form */}
            <div className="flex flex-col justify-center p-6 md:p-12 lg:p-24 bg-black relative grow">
                <div className="max-w-sm mx-auto w-full space-y-8 relative z-10">
                    <div className="space-y-2 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-white">
                            {isSignUp ? 'Create an account' : 'Welcome back'}
                        </h2>
                        <p className="text-gray-400 text-sm">
                            {isSignUp ? 'Enter your details below to create your account' : 'Enter your email below to login to your account'}
                        </p>
                    </div>

                    {/* Premium Form Card */}
                    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-1">Email</label>
                                <Input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    required
                                    placeholder="name@example.com"
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide ml-1">Password</label>
                                <Input
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold shadow-lg shadow-white/5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-2"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                        Processing...
                                    </span>
                                ) : (
                                    isSignUp ? 'Sign Up' : 'Sign In'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-white/5 text-center">
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto group"
                            >
                                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                                <span className="text-amber-500 group-hover:underline decoration-amber-500/50 underline-offset-4">
                                    {isSignUp ? 'Sign In' : 'Sign Up'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
