'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export function OrgSwitchOverlay({ orgName }: { orgName?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center text-white"
        >
            <div className="flex flex-col items-center gap-6">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-black shadow-2xl shadow-white/20"
                >
                    <Loader2 className="w-10 h-10 animate-spin" />
                </motion.div>

                <div className="text-center space-y-2">
                    <motion.h3
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl font-bold tracking-tight"
                    >
                        {orgName ? `Switching to ${orgName}...` : 'Switching Organization...'}
                    </motion.h3>
                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-gray-400 font-medium"
                    >
                        Please wait while we update your dashboard.
                    </motion.p>
                </div>
            </div>
        </motion.div>
    )
}
