'use client'

import { AlertTriangle, ArrowRight, Building2, User, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DashboardAlertsClientProps {
    needsSettlement: boolean
    needsSetup: boolean
    missingOrg: boolean
    missingProfile: boolean
}

export function DashboardAlertsClient({
    needsSettlement,
    needsSetup,
    missingOrg,
    missingProfile
}: DashboardAlertsClientProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const totalAlerts = (needsSetup ? 1 : 0) + (needsSettlement ? 1 : 0)

    if (totalAlerts === 0) return null

    return (
        <div className="w-full max-w-7xl mx-auto mb-8 animate-in slide-in-from-top-6 fade-in duration-700 ease-out fill-mode-forwards">
            <div className="relative overflow-hidden backdrop-blur-3xl bg-white/80 dark:bg-[#111]/90 border border-gray-200/50 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-3xl p-1 transition-all">
                {/* Unified Header */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 dark:bg-white/5 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors rounded-2xl group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 animate-pulse">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-[15px]">
                            Pending Actions
                            <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                {totalAlerts} Required
                            </span>
                        </h4>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-transparent group-hover:bg-white dark:group-hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </button>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <div className="p-2 space-y-1 border-t border-gray-100 dark:border-white/5 mt-1">
                                {/* Item 1: Settlement (Highest Priority - Red) */}
                                {needsSettlement && (
                                    <div className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/10">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                            <div>
                                                <h5 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Connect Settlement Account</h5>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl leading-relaxed">
                                                    Payouts are currently disabled. You must connect a bank account or mobile money to receive funds from ticket sales.
                                                </p>
                                            </div>
                                        </div>
                                        <Link href="/dashboard/settings" className="shrink-0">
                                            <button className="w-full md:w-auto px-5 py-2.5 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-200 text-white dark:text-black text-xs font-bold rounded-xl transition-all shadow-lg shadow-black/5 active:scale-[0.95] flex items-center justify-center gap-2">
                                                Connect Now
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </Link>
                                    </div>
                                )}

                                {/* Separator if both exist */}
                                {needsSettlement && needsSetup && (
                                    <div className="h-px bg-gray-100 dark:bg-white/5 mx-4" />
                                )}

                                {/* Item 2: Setup (Medium Priority - Orange) */}
                                {needsSetup && (
                                    <div className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors border border-transparent hover:border-orange-100 dark:hover:border-orange-500/10">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                            <div>
                                                <h5 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Complete Account Checklist</h5>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {missingOrg && (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-black border border-gray-100 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                                                            <Building2 className="w-3 h-3" />
                                                            Organization Details
                                                        </span>
                                                    )}
                                                    {missingProfile && (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-black border border-gray-100 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                                                            <User className="w-3 h-3" />
                                                            Personal Profile
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Link href="/dashboard/settings" className="shrink-0">
                                            <button className="w-full md:w-auto px-5 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 text-gray-900 dark:text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.95] flex items-center justify-center gap-2">
                                                Finish Setup
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
