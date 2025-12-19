'use client'

import React, { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import Link from 'next/link'

export function LandingHeader() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <div className="absolute top-0 left-0 right-0 p-6 md:p-8 z-50 pointer-events-none flex flex-col items-start">
                {/* Header Row - Branding Pill */}
                <div className="pointer-events-auto animate-fade-in flex items-center gap-2 pl-2 p-2 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl transition-all duration-300 hover:bg-black/30">
                    <Link
                        href="/"
                        className="pl-3 pr-1 text-[14px] font-bold tracking-tight text-white leading-none hover:opacity-80 transition-opacity"
                    >
                        GatePass
                    </Link>
                    <div className="w-px h-3 bg-white/20 mx-0.5" />
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white text-white hover:text-black transition-colors duration-300"
                    >
                        {isOpen ? <X size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
                    </button>
                </div>

                {/* Popup Card - Premium Glass */}
                <div
                    className={`
            pointer-events-auto mt-4 max-w-[90vw] w-[340px] 
            bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl 
            text-black dark:text-white p-6 rounded-3xl shadow-2xl border border-white/20 dark:border-zinc-700/50
            transform transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) origin-top-left
            ${isOpen ? 'opacity-100 scale-100 translate-y-0 translate-x-0' : 'opacity-0 scale-90 -translate-y-4 -translate-x-4 pointer-events-none blur-sm'}
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

            {/* Invisible backdrop to close on outside click (optional but good UX) */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    )
}
