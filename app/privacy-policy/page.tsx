import Link from 'next/link'
import React from 'react'
import { LandingHeader } from '@/components/LandingHeader'

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-white/20">
            <LandingHeader />

            <div className="max-w-3xl mx-auto px-6 md:px-12 pt-32 pb-24">
                {/* Navigation */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-12 group">
                    <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Back to Home
                </Link>

                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {/* Header */}
                    <div className="space-y-6 border-b border-white/10 pb-12">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white">Privacy Policy</h1>
                        <p className="text-gray-400 text-sm font-medium tracking-wide border-l border-white/20 pl-4 py-1">
                            Last refined: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="prose prose-invert prose-lg max-w-none text-gray-400 font-light leading-relaxed">
                        <p className="text-xl text-white font-medium mb-12">
                            At GatePass, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our video-first ticketing platform.
                        </p>

                        <div className="space-y-12">
                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">1. Information We Collect</h2>
                                <p>
                                    We collect information you provide directly to us, such as when you create an account, purchase tickets, or contact customer support. This may include your name, email address, payment information, and device data.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">2. How We Use Your Information</h2>
                                <p>
                                    We use your information to provide/improve our services, process transactions, send you event updates, and personalize your experience. We do not sell your personal data to third parties.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">3. Data Security</h2>
                                <p>
                                    We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">4. Contact Us</h2>
                                <p>
                                    If you have any questions about this Privacy Policy, please contact us at support@gatepass.co.
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
