'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { GatePassMark } from '@/components/branding/GatePassMark'

/** Full-screen hand-off while the dashboard reloads for another organization. */
export function OrgSwitchOverlay({ orgName }: { orgName?: string }) {
    const reduce = useReducedMotion()
    const initial = orgName?.trim().charAt(0).toUpperCase() || 'G'
    const ease = [0.16, 1, 0.3, 1] as const

    return (
        <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#fafafa] text-gray-950 dark:bg-[#080808] dark:text-white"
        >
            <div className="absolute left-1/2 top-8 flex -translate-x-1/2 items-center gap-2 text-sm font-semibold tracking-tight text-gray-400">
                <GatePassMark className="size-5 opacity-60" /> GatePass
            </div>

            <motion.div
                initial={reduce ? false : { scale: 0.85, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="flex size-20 items-center justify-center rounded-[24px] bg-gray-950 text-[34px] font-semibold tracking-tight text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] dark:bg-white dark:text-black dark:shadow-[0_24px_60px_-20px_rgba(255,255,255,0.25)]"
                aria-hidden="true"
            >
                {initial}
            </motion.div>

            <motion.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease }}
                className="mt-7 max-w-[80vw] text-center"
            >
                <p className="text-sm text-gray-500 dark:text-gray-400">Switching to</p>
                <p className="mt-1 truncate text-[26px] font-semibold tracking-[-0.03em]">{orgName || 'your organization'}</p>
            </motion.div>

            {/* Indeterminate progress */}
            <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" aria-hidden="true">
                {reduce ? (
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-gray-950 dark:bg-white" />
                ) : (
                    <motion.div
                        className="h-full w-1/3 rounded-full bg-gray-950 dark:bg-white"
                        initial={{ x: '-100%' }}
                        animate={{ x: '300%' }}
                        transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
                    />
                )}
            </div>
            <span className="sr-only">Loading {orgName || 'organization'} dashboard</span>
        </motion.div>
    )
}
