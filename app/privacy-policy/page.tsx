import Link from 'next/link'
import React from 'react'

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-12">
                {/* Content */}
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Privacy Policy</h1>
                    <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
                        <p>
                            At GatePass, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our video-first ticketing platform.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">1. Information We Collect</h2>
                        <p>
                            We collect information you provide directly to us, such as when you create an account, purchase tickets, or contact customer support. This may include your name, email address, payment information, and device data.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">2. How We Use Your Information</h2>
                        <p>
                            We use your information to provide/improve our services, process transactions, send you event updates, and personalize your experience. We do not sell your personal data to third parties.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">3. Data Security</h2>
                        <p>
                            We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.
                        </p>

                        <h2 className="text-xl font-semibold text-white pt-4">4. Contact Us</h2>
                        <p>
                            If you have any questions about this Privacy Policy, please contact us at support@gatepass.co.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
