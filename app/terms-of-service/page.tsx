import Link from 'next/link'
import React from 'react'

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-12">
                {/* Content */}
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Terms of Service</h1>
                    <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
                        <p>
                            Welcome to GatePass. By accessing or using our platform, you agree to be bound by these Terms of Service.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">1. Acceptance of Terms</h2>
                        <p>
                            By creating an account or purchasing a ticket, you agree to these legal terms. If you do not agree, strictly do not use our services.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">2. User Conduct</h2>
                        <p>
                            You agree not to misuse the platform, infringe on intellectual property, or engage in fraudulent activities. We reserve the right to suspend accounts violating these rules.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">3. Ticket Purchases & Refunds</h2>
                        <p>
                            All ticket sales are final unless otherwise stated by the event organizer. GatePass is a platform and is not responsible for event cancellations, though we will assist in refund processing where applicable.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">4. Limitation of Liability</h2>
                        <p>
                            GatePass is provided "as is". We are not liable for indirect damages, data loss, or service interruptions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
