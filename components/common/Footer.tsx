'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function Footer() {
    const pathname = usePathname()

    // Exclude footer from immersive/app-like pages
    // We allow it on specific content pages or login if needed
    if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/events/') || pathname.startsWith('/ticket/') || pathname.startsWith('/onboarding')) return null

    return (
        <footer className="w-full py-8 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-black">
            <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-white tracking-tight">GatePass</span>
                    <span className="text-gray-400 text-xs">© 2025</span>
                </div>

                <div className="flex items-center gap-6 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Link href="/terms-of-service" className="hover:text-black dark:hover:text-white transition-colors">
                        Terms of Service
                    </Link>
                    <Link href="/privacy-policy" className="hover:text-black dark:hover:text-white transition-colors">
                        Privacy Policy
                    </Link>
                    <a href="mailto:support@gatepass.io" className="hover:text-black dark:hover:text-white transition-colors">
                        Support
                    </a>
                </div>
            </div>
        </footer>
    )
}
