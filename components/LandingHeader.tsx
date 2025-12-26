'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, X, User, LogOut, LayoutDashboard, Ticket, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface LandingHeaderProps {
    showAccountMenu?: boolean
}

export function LandingHeader({ showAccountMenu = false }: LandingHeaderProps) {
    const [isLeftOpen, setIsLeftOpen] = useState(false)
    const [isRightOpen, setIsRightOpen] = useState(false)
    const [user, setUser] = useState<any>(null)
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setIsRightOpen(false)
        router.push('/')
    }

    return (
        <>
            <div className="absolute top-0 left-0 right-0 p-4 md:p-8 z-50 pointer-events-none flex justify-between items-start gap-2">
                {/* LEFT PILL */}
                <div className="flex flex-col items-start gap-4">
                    <div className="pointer-events-auto animate-fade-in flex items-center bg-gray-100/80 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-full shadow-lg transition-all duration-300 hover:bg-white/90 dark:hover:bg-black/30">
                        <Link
                            href="/"
                            className="pl-4 md:pl-5 pr-2 md:pr-3 py-2 md:py-2.5 text-[13px] md:text-[14px] font-bold tracking-tight text-black dark:text-white leading-none hover:opacity-80 transition-opacity"
                        >
                            GatePass
                        </Link>
                        <div className="w-px h-3 md:h-4 bg-black/10 dark:bg-white/20" />
                        <button
                            onClick={() => {
                                setIsLeftOpen(!isLeftOpen)
                                if (isRightOpen) setIsRightOpen(false)
                            }}
                            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors duration-300"
                        >
                            {isLeftOpen ? <X className="w-4 h-4 md:w-4 md:h-4" strokeWidth={2.5} /> : <ChevronDown className="w-4 h-4 md:w-4 md:h-4" strokeWidth={2.5} />}
                        </button>
                    </div>

                    {/* Left Popup Card */}
                    <div
                        className={`
                            pointer-events-auto max-w-[90vw] w-[340px] 
                            bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl 
                            text-black dark:text-white p-6 rounded-3xl shadow-2xl border border-white/20 dark:border-zinc-700/50
                            transform transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) origin-top-left
                            ${isLeftOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-4 pointer-events-none blur-sm'}
                        `}
                    >
                        <div className="space-y-4">
                            <p className="text-[13px] leading-relaxed text-gray-800 dark:text-gray-200 font-medium tracking-wide">
                                <span className="block mb-2 font-bold text-black dark:text-white text-[15px]">The future of events.</span>
                                GatePass is the first video-powered marketplace. Watch the highlights, catch the energy, and secure your spot in seconds.
                            </p>

                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-700 to-transparent w-full" />

                            <div className="flex flex-col gap-2">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">For Creators</p>
                                <p className="text-[12px] text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                                    Sell out faster with immersive video listings. Zero setup costs. Instant payouts.
                                </p>
                            </div>

                            <div className="pt-4 mt-2 border-t border-gray-100 dark:border-zinc-800/50 flex flex-col gap-2">
                                <div className="flex gap-4 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    <a href="/terms-of-service" className="hover:text-black dark:hover:text-white transition-colors">Terms</a>
                                    <a href="/privacy-policy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT PILL */}
                {showAccountMenu && (
                    <div className="flex flex-col items-end gap-4">
                        <div className="pointer-events-auto animate-fade-in flex items-center bg-gray-100/80 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-full shadow-lg transition-all duration-300 hover:bg-white/90 dark:hover:bg-black/30">
                            {user ? (
                                <button
                                    onClick={() => {
                                        setIsRightOpen(!isRightOpen)
                                        if (isLeftOpen) setIsLeftOpen(false)
                                    }}
                                    className="pl-4 md:pl-5 pr-2 md:pr-3 py-2 md:py-2.5 text-[13px] md:text-[14px] font-bold tracking-tight text-black dark:text-white leading-none hover:opacity-80 transition-opacity flex items-center gap-2 md:gap-2.5"
                                >
                                    <div className="hidden xs:flex w-5 md:w-6 h-5 md:h-6 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center">
                                        <User className="w-3 h-3 md:w-3.5 md:h-3.5 text-black/70 dark:text-white/70" />
                                    </div>
                                    Account
                                </button>
                            ) : (
                                <Link
                                    href="/login"
                                    className="pl-4 md:pl-5 pr-2 md:pr-4 py-2 md:py-2.5 text-[13px] md:text-[14px] font-bold tracking-tight text-black dark:text-white leading-none hover:opacity-80 transition-opacity"
                                >
                                    Login
                                </Link>
                            )}
                            <div className="w-px h-3 md:h-4 bg-black/10 dark:bg-white/20" />
                            <button
                                onClick={() => {
                                    if (!user) {
                                        router.push('/login')
                                        return
                                    }
                                    setIsRightOpen(!isRightOpen)
                                    if (isLeftOpen) setIsLeftOpen(false)
                                }}
                                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors duration-300"
                            >
                                {isRightOpen ? <X className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.5} /> : <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.5} />}
                            </button>
                        </div>

                        {/* Right Popup Card */}
                        {user && (
                            <div
                                className={`
                                    pointer-events-auto max-w-[90vw] w-[280px] 
                                    bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl 
                                    text-black dark:text-white p-6 rounded-3xl shadow-2xl border border-white/20 dark:border-zinc-700/50
                                    transform transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) origin-top-right
                                    ${isRightOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-4 pointer-events-none blur-sm'}
                                `}
                            >
                                <div className="space-y-4">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Logged in as</span>
                                        <span className="text-[14px] font-bold truncate text-black dark:text-white">{user.email}</span>
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-700 to-transparent w-full" />

                                    <div className="flex flex-col gap-1">
                                        <Link
                                            href="/my-tickets"
                                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                                            onClick={() => setIsRightOpen(false)}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-black dark:group-hover:bg-white transition-colors">
                                                <Ticket size={16} className="text-gray-600 dark:text-gray-400 group-hover:text-white dark:group-hover:text-black" />
                                            </div>
                                            <span className="text-[13px] font-bold">My Tickets</span>
                                        </Link>

                                        <Link
                                            href="/dashboard"
                                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                                            onClick={() => setIsRightOpen(false)}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-black dark:group-hover:bg-white transition-colors">
                                                <LayoutDashboard size={16} className="text-gray-600 dark:text-gray-400 group-hover:text-white dark:group-hover:text-black" />
                                            </div>
                                            <span className="text-[13px] font-bold">Creator Dashboard</span>
                                        </Link>
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-700 to-transparent w-full" />

                                    {/* Theme Switcher */}
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Appearance</span>
                                        <div className="flex p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                                            {[
                                                { id: 'light', icon: Sun, label: 'Light' },
                                                { id: 'dark', icon: Moon, label: 'Dark' },
                                                { id: 'system', icon: Monitor, label: 'Auto' }
                                            ].map((mode) => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => mounted && setTheme(mode.id)}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[12px] font-bold transition-all ${mounted && theme === mode.id
                                                        ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm'
                                                        : 'text-gray-500 hover:text-black dark:hover:text-white'
                                                        }`}
                                                >
                                                    <mode.icon size={14} />
                                                    <span>{mode.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-700 to-transparent w-full" />

                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 p-2 rounded-xl w-full text-left hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                                            <LogOut size={16} className="text-red-600 dark:text-red-400 group-hover:text-white" />
                                        </div>
                                        <span className="text-[13px] font-bold text-red-600 dark:text-red-400">Logout</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Backdrop */}
            {(isLeftOpen || isRightOpen) && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => {
                        setIsLeftOpen(false)
                        setIsRightOpen(false)
                    }}
                />
            )}
        </>
    )
}
