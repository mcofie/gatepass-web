'use client'

import React, { useState, useEffect } from 'react'
import { ArrowUpRight, ChevronDown, X, User, LogOut, LayoutDashboard, Ticket } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GatePassMark } from '@/components/branding/GatePassMark'

interface LandingHeaderProps {
    showAccountMenu?: boolean
}

export function LandingHeader({ showAccountMenu = false }: LandingHeaderProps) {
    const [isLeftOpen, setIsLeftOpen] = useState(false)
    const [isRightOpen, setIsRightOpen] = useState(false)
    const [user, setUser] = useState<any>(null)
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const leftMenuButtonRef = React.useRef<HTMLButtonElement>(null)
    const rightMenuButtonRef = React.useRef<HTMLButtonElement>(null)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!isLeftOpen) return
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsLeftOpen(false)
                leftMenuButtonRef.current?.focus()
            }
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [isLeftOpen])

    useEffect(() => {
        if (!isRightOpen) return
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsRightOpen(false)
                rightMenuButtonRef.current?.focus()
            }
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [isRightOpen])

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
                {/* Brand and about menu */}
                <div className="relative flex flex-col items-start gap-2">
                    <div className="pointer-events-auto animate-fade-in flex items-center rounded-full border border-black/[0.06] bg-white/90 text-black shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80 dark:text-white">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 pl-3 pr-3 py-2.5 text-[14px] font-semibold tracking-tight leading-none hover:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded-l-full max-[360px]:pl-2.5 max-[360px]:pr-2.5"
                        >
                            <GatePassMark className="size-5" />
                            GatePass
                        </Link>
                        <div className="w-px h-4 bg-black/10 dark:bg-white/15" />
                        <button
                            ref={leftMenuButtonRef}
                            onClick={() => {
                                setIsLeftOpen(!isLeftOpen)
                                if (isRightOpen) setIsRightOpen(false)
                            }}
                            type="button"
                            aria-label={isLeftOpen ? 'Close about menu' : 'About GatePass'}
                            aria-expanded={isLeftOpen}
                            aria-controls="gatepass-about-panel"
                            className="px-3 py-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-700 hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-r-full dark:text-gray-300 dark:hover:text-white dark:focus-visible:ring-white max-[360px]:px-2"
                        >
                            <span className="max-[360px]:sr-only">{isLeftOpen ? 'Close' : 'About'}</span>
                            {isLeftOpen ? <X aria-hidden="true" className="w-3.5 h-3.5" /> : <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    {isLeftOpen && (
                        <div
                            id="gatepass-about-panel"
                            className="pointer-events-auto absolute left-0 top-full mt-2 w-[300px] max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-xl text-black p-4 rounded-[20px] shadow-xl border border-black/5 dark:bg-zinc-900/95 dark:text-white dark:border-white/10 animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                            <h2 className="text-[15px] font-semibold tracking-tight">Events worth showing up for.</h2>
                            <p className="mt-1 text-[12px] leading-[1.5] text-gray-600 dark:text-gray-400">
                                Discover events through video and book your place in seconds.
                            </p>

                            <nav aria-label="GatePass links" className="mt-4 border-t border-gray-100 divide-y divide-gray-100 dark:border-white/10 dark:divide-white/10">
                                <Link href="/" onClick={() => setIsLeftOpen(false)} className="flex items-center justify-between py-3 text-[13px] font-medium hover:text-gray-600 focus-visible:outline-none focus-visible:underline dark:hover:text-gray-300">
                                    Explore events <ArrowUpRight aria-hidden="true" className="w-4 h-4 text-gray-400" />
                                </Link>
                                <Link href="/dashboard/events/create" onClick={() => setIsLeftOpen(false)} className="flex items-center justify-between py-3 text-[13px] font-medium hover:text-gray-600 focus-visible:outline-none focus-visible:underline dark:hover:text-gray-300">
                                    Create an event <ArrowUpRight aria-hidden="true" className="w-4 h-4 text-gray-400" />
                                </Link>
                            </nav>

                            <div className="flex gap-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 dark:border-white/10 dark:text-gray-400">
                                <Link href="/terms-of-service" onClick={() => setIsLeftOpen(false)} className="hover:text-black dark:hover:text-white focus-visible:outline-none focus-visible:underline">Terms of Service</Link>
                                <Link href="/privacy-policy" onClick={() => setIsLeftOpen(false)} className="hover:text-black dark:hover:text-white focus-visible:outline-none focus-visible:underline">Privacy Policy</Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Account menu */}
                {showAccountMenu && (
                    <div className="relative flex flex-col items-end">
                        {user ? (
                            <button
                                ref={rightMenuButtonRef}
                                type="button"
                                aria-expanded={isRightOpen}
                                aria-controls="gatepass-account-panel"
                                onClick={() => {
                                    setIsRightOpen(!isRightOpen)
                                    if (isLeftOpen) setIsLeftOpen(false)
                                }}
                                className="pointer-events-auto animate-fade-in inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.06] bg-white/90 px-3.5 text-[13px] font-medium text-black shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-white/10 dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-800/90 dark:focus-visible:ring-white"
                            >
                                <User aria-hidden="true" className="size-4" strokeWidth={1.8} />
                                <span>Account</span>
                                <ChevronDown aria-hidden="true" className={`ml-0.5 size-3.5 text-gray-500 transition-transform duration-150 dark:text-gray-400 ${isRightOpen ? 'rotate-180' : ''}`} />
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                className="pointer-events-auto animate-fade-in inline-flex h-10 items-center rounded-full border border-black/[0.06] bg-white/90 px-4 text-[13px] font-medium text-black shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-white/10 dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-800/90 dark:focus-visible:ring-white"
                            >
                                Log in
                            </Link>
                        )}

                        {user && isRightOpen && (
                            <div
                                id="gatepass-account-panel"
                                className="pointer-events-auto absolute right-0 top-full mt-2 w-[272px] max-w-[calc(100vw-2rem)] rounded-2xl border border-black/10 bg-white p-2 text-black shadow-[0_12px_36px_rgba(0,0,0,0.14)] animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none dark:border-white/15 dark:bg-[#171717] dark:text-white dark:shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
                            >
                                <div className="px-3 pb-3 pt-2">
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Signed in as</p>
                                    <p className="mt-0.5 truncate text-[13px] font-medium" title={user.email}>{user.email}</p>
                                </div>

                                <nav aria-label="Account links" className="border-t border-black/10 py-1 dark:border-white/10">
                                    <Link
                                        href="/my-tickets"
                                        className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:hover:bg-white/10 dark:focus-visible:ring-white"
                                        onClick={() => setIsRightOpen(false)}
                                    >
                                        <Ticket aria-hidden="true" className="size-4 text-gray-500 dark:text-gray-400" strokeWidth={1.8} />
                                        My tickets
                                    </Link>

                                    <Link
                                        href="/dashboard"
                                        className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:hover:bg-white/10 dark:focus-visible:ring-white"
                                        onClick={() => setIsRightOpen(false)}
                                    >
                                        <LayoutDashboard aria-hidden="true" className="size-4 text-gray-500 dark:text-gray-400" strokeWidth={1.8} />
                                        Creator dashboard
                                    </Link>
                                </nav>

                                <div className="border-t border-black/10 px-3 py-3 dark:border-white/10">
                                    <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">Appearance</p>
                                    <div role="group" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-lg bg-[#f3f3f3] p-1 dark:bg-[#292929]">
                                        {[
                                            { id: 'light', label: 'Light' },
                                            { id: 'dark', label: 'Dark' },
                                            { id: 'system', label: 'System' }
                                        ].map((mode) => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                aria-pressed={mounted && theme === mode.id}
                                                onClick={() => mounted && setTheme(mode.id)}
                                                className={`h-8 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ${mounted && theme === mode.id
                                                    ? 'bg-white text-black shadow-sm dark:bg-[#454545] dark:text-white'
                                                    : 'text-gray-600 hover:text-black dark:text-gray-300 dark:hover:text-white'
                                                    }`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-black/10 pt-1 dark:border-white/10">
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:hover:bg-white/10 dark:focus-visible:ring-white"
                                    >
                                        <LogOut aria-hidden="true" className="size-4 text-gray-500 dark:text-gray-400" strokeWidth={1.8} />
                                        Log out
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
