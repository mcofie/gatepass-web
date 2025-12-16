'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

export function Footer() {
    const pathname = usePathname()

    if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/events/') || pathname.startsWith('/ticket/') || pathname === '/privacy-policy' || pathname === '/terms-of-service') return null

    return (
        <footer className="bg-black border-t border-white/10 pt-20 pb-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-black rounded-sm"></div>
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">Gatepass</span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                            The premium platform for exclusive events, seamless reservations, and unforgettable experiences.
                        </p>
                        <div className="flex gap-4">
                            {['Twitter', 'Instagram', 'LinkedIn'].map((social) => (
                                <a key={social} href="#" className="text-gray-500 hover:text-white transition-colors text-sm">
                                    {social}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Platform Links */}
                    <div>
                        <h4 className="font-bold text-white mb-6">Platform</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Browse Events</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">For Organizers</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">How it Works</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Pricing</a></li>
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div>
                        <h4 className="font-bold text-white mb-6">Support</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Help Center</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Contact Us</a></li>
                            <li><a href="/terms-of-service" className="hover:text-amber-500 transition-colors">Terms of Service</a></li>
                            <li><a href="/privacy-policy" className="hover:text-amber-500 transition-colors">Privacy Policy</a></li>
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div>
                        <h4 className="font-bold text-white mb-6">Stay Updated</h4>
                        <p className="text-gray-400 text-sm mb-4">
                            Subscribe to get priority access to new event drops.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 w-full"
                            />
                            <button className="bg-white text-black px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors">
                                Join
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
                    <p>&copy; {new Date().getFullYear()} Gatepass Inc. All rights reserved.</p>
                    <div className="flex gap-6">
                        <span>Made with 🖤 in Accra</span>
                        <span>v2.0.0 (Premium)</span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
