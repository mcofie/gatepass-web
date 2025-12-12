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

    return (
        <nav className="border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
                    Gatepass.
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-6">
                    <Link href="/" className="text-sm font-medium hover:text-black dark:hover:text-white text-gray-600 dark:text-gray-400 transition">
                        Events
                    </Link>

                    {user && (
                        <Link href="/my-tickets" className="text-sm font-medium hover:text-black dark:hover:text-white text-gray-600 dark:text-gray-400 transition">
                            My Tickets
                        </Link>
                    )}

                    {user && user.email?.toLowerCase() === 'maxcofie@gmail.com' && (
                        <Link href="/dashboard" className="text-sm font-medium hover:text-black dark:hover:text-white text-gray-600 dark:text-gray-400 transition">
                            Dashboard
                        </Link>
                    )}

                    {user ? (
                        <div className="flex items-center gap-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
                            <button
                                onClick={handleLogout}
                                className="text-sm font-medium text-red-600 hover:text-red-700 transition"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        !pathname.startsWith('/checkout') && !pathname.includes('/events/') && (
                            <Link href="/login">
                                <button className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition">
                                    Sign In
                                </button>
                            </Link>
                        )
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 text-gray-600 dark:text-gray-300"
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
                <div className="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 shadow-xl animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col p-4 space-y-4">
                        <Link
                            href="/"
                            className="text-base font-medium text-gray-900 dark:text-white py-2"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Events
                        </Link>

                        {user && (
                            <Link
                                href="/my-tickets"
                                className="text-base font-medium text-gray-900 dark:text-white py-2"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                My Tickets
                            </Link>
                        )}

                        {user && user.email?.toLowerCase() === 'maxcofie@gmail.com' && (
                            <Link
                                href="/dashboard"
                                className="text-base font-medium text-gray-900 dark:text-white py-2"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Dashboard
                            </Link>
                        )}

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                            {user ? (
                                <div className="space-y-4">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left text-base font-medium text-red-600"
                                    >
                                        Logout
                                    </button>
                                </div>
                            ) : (
                                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                    <button className="w-full bg-black dark:bg-white text-white dark:text-black px-4 py-3 rounded-xl text-base font-medium">
                                        Sign In
                                    </button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    )
}
