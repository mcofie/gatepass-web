'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

interface ImmersiveBackgroundProps {
    posterUrl: string | null | undefined
}

export const ImmersiveBackground = ({ posterUrl }: ImmersiveBackgroundProps) => {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden bg-[#0a0a0a]">
            {posterUrl && (
                <>
                    <motion.div
                        initial={{ opacity: 0, scale: 1.2 }}
                        animate={{ opacity: 0.4, scale: 1 }}
                        transition={{ duration: 2 }}
                        className="absolute inset-0"
                    >
                        <Image
                            src={posterUrl}
                            alt=""
                            fill
                            className="object-cover blur-[100px] scale-150"
                            priority
                        />
                    </motion.div>

                    {/* Secondary Mesh Globs */}
                    <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-white/10 to-transparent blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-white/5 to-transparent blur-[100px]" />

                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
                </>
            )}
        </div>
    )
}
