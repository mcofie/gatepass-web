'use client'

import React, { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

export function LandingHeader() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <div className="absolute top-0 left-0 right-0 p-6 md:p-8 z-50 pointer-events-none flex flex-col items-start">
                {/* Header Row - Blends with video */}
                <div className="flex items-center gap-0.5 pointer-events-auto mix-blend-difference text-white">
                    <div className="text-xl font-bold tracking-tighter cursor-pointer">GatePass.</div>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="group flex items-center justify-center w-6 h-6 hover:opacity-70 transition-opacity"
                        aria-label={isOpen ? "Close info" : "Show info"}
                    >
                        {isOpen ? <X size={16} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                    </button>
                </div>

                {/* Popup Card - Solid White with refined typography */}
                <div
                    className={`
            pointer-events-auto mt-4 max-w-[90vw] w-[360px] bg-white text-black p-5 rounded-2xl shadow-xl border border-white/20
            transform transition-all duration-300 ease-out origin-top-left
            ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-4 pointer-events-none'}
          `}
                >
                    <div className="space-y-3">
                        <p className="text-[13px] leading-relaxed text-gray-800 tracking-wide font-medium">
                            <span className="block mb-2 font-bold text-black">Don't just buy a ticket. Feel the vibe.</span>
                            GatePass is the first video-powered marketplace for events. Watch the highlights, catch the energy, and secure your spot in seconds.
                        </p>
                        <p className="text-[13px] leading-relaxed text-gray-800 tracking-wide font-medium">
                            <span className="block mb-2 font-bold text-black">Hosting an event?</span>
                            Sell out faster with immersive video listings. Enjoy lower fees, instant payouts, and better mobile conversion—with zero setup costs.
                        </p>
                        <div className="pt-3 mt-1 border-t border-gray-100 flex flex-col gap-1.5">
                            <div className="flex gap-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                                <a href="/terms-of-service" className="hover:text-black transition-colors">Terms & Conditions</a>
                                <a href="/privacy-policy" className="hover:text-black transition-colors">Privacy Policy</a>
                            </div>
                            <p className="text-[11px] text-gray-400 font-medium">
                                © {new Date().getFullYear()} GatePass Inc. All rights reserved.
                            </p>
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
