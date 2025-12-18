import Link from 'next/link'
import React from 'react'
import { LandingHeader } from '@/components/LandingHeader'

export default function TermsOfService() {
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
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white">Terms of Service</h1>
                        <p className="text-gray-400 text-sm font-medium tracking-wide border-l border-white/20 pl-4 py-1">
                            Last refined: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="prose prose-invert prose-lg max-w-none text-gray-400 font-light leading-relaxed">
                        <p className="text-xl text-white font-medium mb-12">
                            Welcome to GatePass. By accessing or using our platform, you agree to be bound by these Terms of Service.
                        </p>

                        <div className="space-y-12">
                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">1. Acceptance of Terms</h2>
                                <p>
                                    By creating an account or purchasing a ticket, you agree to these legal terms. If you do not agree, strictly do not use our services.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">2. User Conduct</h2>
                                <p>
                                    You agree not to misuse the platform, infringe on intellectual property, or engage in fraudulent activities. We reserve the right to suspend accounts violating these rules.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">3. Ticket Purchases & Refunds</h2>
                                <p>
                                    All ticket sales are final unless otherwise stated by the event organizer. GatePass is a platform and is not responsible for event cancellations, though we will assist in refund processing where applicable.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-white tracking-tight mb-4">4. Limitation of Liability</h2>
                                <p>
                                    GatePass is provided "as is". We are not liable for indirect damages, data loss, or service interruptions.
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
