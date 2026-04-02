'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function Footer() {
    const pathname = usePathname()

    // Exclude footer from immersive/app-like pages
    const isImmersive = pathname === '/' || 
                        pathname.startsWith('/dashboard') || 
                        pathname.startsWith('/events/') || 
                        pathname.startsWith('/ticket/') || 
                        pathname.startsWith('/onboarding')

    if (isImmersive) return null

    return (
        <footer className="w-full py-8 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-black transition-colors duration-300">
            <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-white tracking-tight">GatePass.so</span>
                    <span className="text-gray-400 text-xs">© {new Date().getFullYear()}</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Link href="/our-offering" className="hover:text-black dark:hover:text-white transition-colors">
                        Our Offering
                    </Link>
                    <Link href="/terms-of-service" className="hover:text-black dark:hover:text-white transition-colors">
                        Terms of Service
                    </Link>
                    <Link href="/privacy-policy" className="hover:text-black dark:hover:text-white transition-colors">
                        Privacy Policy
                    </Link>
                    <a href="mailto:support@gatepass.so" className="hover:text-black dark:hover:text-white transition-colors">
                        Support
                    </a>
                </div>
            </div>
        </footer>
    )
}
