import React from 'react'
import Link from 'next/link'
import {
    PlayCircle,
    WalletCards,
    LayoutDashboard,
    Activity,
    Users,
    ScanLine,
    BarChart3,
    ArrowRight,
    CheckCircle2
} from 'lucide-react'

export const metadata = {
    title: 'Our Offering | For Organizers | GatePass',
    description: 'Discover the advanced tools GatePass provides to manage, market, and monetize your events like never before.',
}

export default function OurOfferingPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black font-sans">
            {/* HER0 BACKGROUND (Dark to support NavBar) */}
            <div className="relative pt-32 pb-20 md:pt-48 md:pb-32 bg-[#0a0a0a] overflow-hidden text-white border-b border-white/10 min-h-[80vh] flex flex-col justify-center">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    >
                        <source src="https://assets.mixkit.co/videos/preview/mixkit-crowd-of-people-at-a-music-festival-4330-large.mp4" type="video/mp4" />
                    </video>
                    {/* Dark Tint for Readability */}
                    <div className="absolute inset-0 bg-black/70" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-white/5 to-white/10 blur-[100px] rounded-full opacity-50" />
                </div>
                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8 max-w-4xl mx-auto leading-[1.1]">
                        The Ultimate Operating System for Modern Events
                    </h1>
                    <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-medium">
                        Ditch the outdated ticketing platforms. GatePass gives you video-powered listings, flexible payments, and real-time operations inside one sleek dashboard.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/onboarding"
                            className="bg-white text-black px-8 py-3.5 rounded-full font-bold shadow-lg shadow-white/10 hover:scale-105 active:scale-95 transition-all text-sm w-full sm:w-auto flex items-center justify-center gap-2"
                        >
                            Start Organizing Free <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/login"
                            className="bg-white/10 text-white border border-white/20 px-8 py-3.5 rounded-full font-bold hover:bg-white/20 active:scale-95 transition-all text-sm w-full sm:w-auto text-center"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>

            {/* VALUE PROPOSITION / CORE FEATURES GRID */}
            <section className="py-24 px-6 relative dark:bg-[#0a0a0a]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
                            Everything You Need to Sell Out
                        </h2>
                        <p className="text-gray-500 max-w-xl mx-auto font-medium text-lg">
                            We've reimagined event organization from the ground up to give you more control, better insights, and higher conversion rates.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* 1 */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow group">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-6 border border-orange-200 dark:border-orange-500/20 group-hover:scale-110 transition-transform">
                                <PlayCircle className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Video-First Listings</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                                Show, don't just tell. Upload immersive, vertical video highlights to sell the true vibe of your event directly on your ticket page.
                            </p>
                        </div>

                        {/* 2 */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow group">
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center mb-6 border border-green-200 dark:border-green-500/20 group-hover:scale-110 transition-transform">
                                <WalletCards className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Flexible Payment Plans</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                                Increase sales by offering built-in instalment plans (Buy Now, Pay Later). You secure the customer while we handle the scattered payments.
                            </p>
                        </div>

                        {/* 3 */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow group">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 border border-blue-200 dark:border-blue-500/20 group-hover:scale-110 transition-transform">
                                <Activity className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Live Monitor</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                                Track doors in real-time. See live attendances, ticket scans, and recent activity flow in directly to your dashboard during the event.
                            </p>
                        </div>

                        {/* 4 */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow group">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6 border border-purple-200 dark:border-purple-500/20 group-hover:scale-110 transition-transform">
                                <ScanLine className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Instant Scanning</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                                Turn any smartphone into a blazing fast checkpoint. Our built-in scanning tools ensure smooth, secure entry without extra hardware.
                            </p>
                        </div>

                        {/* 5 */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow group">
                            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-6 border border-rose-200 dark:border-rose-500/20 group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Team Collaboration</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                                Organizing isn't a solo job. Invite your team members, assign specific roles, and manage multiple organizations seamlessly.
                            </p>
                        </div>

                        {/* 6 */}
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow group">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6 border border-indigo-200 dark:border-indigo-500/20 group-hover:scale-110 transition-transform">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Deep Insights</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                                Understand your audience. Track UTM marketing links, analyze customer purchasing habits, and view comprehensive payout histories.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* DEEP DIVE SECTION */}
            <section className="py-24 bg-white dark:bg-black border-t border-gray-100 dark:border-white/10">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="flex-1 space-y-8">
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                                Designed for <br className="hidden md:block" /> Scale & Speed
                            </h2>
                            <p className="text-lg text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                GatePass doesn't just process tickets; it actively works to improve your operational flow. From initial setup to final payout, every step is optimized for the modern organizer.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    'Zero friction event creation with instant publishing',
                                    'Multi-tier ticketing structures & dynamic pricing',
                                    'Secure transfers to prevent ticket fraud',
                                    'Comprehensive attendee data ownership'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex-1 relative w-full aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                            {/* Abstract mockup / representation of dashboard */}
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-200 dark:from-zinc-800 dark:to-zinc-950 flex flex-col p-6 font-mono text-xs">
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <LayoutDashboard className="w-5 h-5 opacity-50" />
                                        <span className="font-bold opacity-70">GatePass Dashboard</span>
                                    </div>
                                    <span className="bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded font-bold">Online</span>
                                </div>
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1 bg-white dark:bg-black rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5">
                                        <p className="opacity-50 mb-1">Total Revenue</p>
                                        <p className="text-2xl font-sans font-bold">$42,500.00</p>
                                    </div>
                                    <div className="flex-1 bg-white dark:bg-black rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5">
                                        <p className="opacity-50 mb-1">Tickets Sold</p>
                                        <p className="text-2xl font-sans font-bold">850 / 1000</p>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white dark:bg-black rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5 mt-2 flex flex-col">
                                    <p className="opacity-50 mb-4">Live Check-ins</p>
                                    <div className="flex-1 flex items-end gap-2 px-2 pb-2">
                                        {[40, 60, 45, 80, 50, 90, 100, 75].map((h, i) => (
                                            <div key={i} className="flex-1 bg-black/10 dark:bg-white/10 rounded-t-sm animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PRICING & PAYOUTS SECTION */}
            <section className="py-24 px-6 bg-gray-50 dark:bg-[#0a0a0a]">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-6">
                        Transparent Pricing. Faster Payouts.
                    </h2>
                    <p className="text-lg text-gray-500 dark:text-gray-400 font-medium mb-12 max-w-2xl mx-auto">
                        We don't believe in hidden fees or holding onto your revenue. Everything is clear from day one.
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm text-left flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Platform & Processing</h3>
                                <div className="flex items-end gap-2 mb-6">
                                    <span className="text-4xl font-black text-gray-900 dark:text-white text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">5.95%</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-1 font-medium">total per ticket</span>
                                </div>
                            </div>
                            <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400 font-medium flex-1">
                                <li className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/5">
                                    <span>GatePass Platform Fee</span>
                                    <span className="text-gray-900 dark:text-white font-bold bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">4.00%</span>
                                </li>
                                <li className="flex justify-between items-center pt-1">
                                    <span>Payment Processor Fee</span>
                                    <span className="text-gray-900 dark:text-white font-bold bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">1.95%</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm text-left flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Swift Payouts</h3>
                                <div className="flex items-end gap-2 mb-6">
                                    <span className="text-4xl font-black text-green-600 dark:text-green-400">1</span>
                                    <span className="text-gray-500 dark:text-gray-400 mb-1 font-medium">working day</span>
                                </div>
                            </div>
                            <p className="text-base text-gray-500 dark:text-gray-400 font-medium leading-relaxed flex-1">
                                Need your funds to cover event costs? Your capital is yours. Request a payout at any time straight to your bank account, and get your money in just <span className="text-gray-900 dark:text-white font-bold">one working day</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="py-24 px-6 bg-[#000] text-white">
                <div className="max-w-4xl mx-auto bg-[#111] rounded-[3rem] p-12 md:p-20 text-center border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
                    <h2 className="text-3xl md:text-5xl font-black mb-6 relative z-10 tracking-tight leading-tight">
                        Ready to elevate your next event?
                    </h2>
                    <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-medium relative z-10">
                        Join the fastest growing platform tailored entirely for the modern event producer. No commitments, just pure performance.
                    </p>
                    <div className="relative z-10">
                        <Link
                            href="/onboarding"
                            className="inline-flex items-center gap-3 bg-white text-black px-10 py-5 rounded-full font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-lg"
                        >
                            Get Started Now <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}
