'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export function NavBar() {
    const [user, setUser] = useState<User | null>(null)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()

    useEffect(() => {
        // Get initial session
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
        })

        // Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
        setIsMobileMenuOpen(false)
    }

    if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/events/') || pathname === '/login') return null

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center py-4 px-4 pointer-events-none">
            <div className="w-full max-w-5xl pointer-events-auto">
                <div className="glass rounded-2xl flex items-center justify-between px-6 py-4 shadow-sm transition-all duration-300">
                    <Link href="/" className="font-bold text-xl tracking-tight text-white mix-blend-difference">
                        Gatepass.
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">
                            Events
                        </Link>

                        {user && (
                            <Link href="/my-tickets" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">
                                My Tickets
                            </Link>
                        )}

                        {user && ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com'].includes(user.email?.toLowerCase() || '') && (
                            <Link href="/dashboard" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">
                                Dashboard
                            </Link>
                        )}

                        {user ? (
                            <div className="flex items-center gap-4 pl-6 border-l border-gray-200 dark:border-white/10">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tracking-wide hidden lg:block">{user.email}</span>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors"
                                >
                                    Log out
                                </button>
                            </div>
                        ) : (
                            !pathname.startsWith('/checkout') && !pathname.includes('/events/') && (
                                <Link href="/login">
                                    <button className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-100 transition-transform active:scale-95 shadow-lg shadow-white/10 border border-white/20">
                                        Sign In
                                    </button>
                                </Link>
                            )
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isMobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Dropdown */}
                {isMobileMenuOpen && (
                    <div className="mt-2 glass rounded-2xl p-2 animate-scale-in origin-top">
                        <div className="flex flex-col space-y-1">
                            <Link
                                href="/"
                                className="block px-4 py-3 rounded-xl text-sm font-medium text-gray-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Events
                            </Link>

                            {user && (
                                <Link
                                    href="/my-tickets"
                                    className="block px-4 py-3 rounded-xl text-sm font-medium text-gray-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    My Tickets
                                </Link>
                            )}

                            {user && ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com'].includes(user.email?.toLowerCase() || '') && (
                                <Link
                                    href="/dashboard"
                                    className="block px-4 py-3 rounded-xl text-sm font-medium text-gray-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Dashboard
                                </Link>
                            )}

                            <div className="h-px bg-gray-200 dark:bg-white/10 my-2 mx-2"></div>

                            {user ? (
                                <>
                                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-mono">{user.email}</div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                    >
                                        Log out
                                    </button>
                                </>
                            ) : (
                                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                    <button className="w-full bg-white text-black px-4 py-3 rounded-xl text-sm font-bold shadow-sm">
                                        Sign In
                                    </button>
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
