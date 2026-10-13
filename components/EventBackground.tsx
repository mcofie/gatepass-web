'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'

interface EventBackgroundProps {
    videoUrl: string | null
    posterUrl: string | null
    forcePause?: boolean
    layoutId?: string
}

export function EventBackground({ videoUrl, posterUrl, forcePause, layoutId }: EventBackgroundProps) {
    const [isMuted, setIsMuted] = useState(true)
    const [showVideo, setShowVideo] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (forcePause || !videoUrl) {
            setShowVideo(false)
            return
        }

        const timer = window.setTimeout(() => setShowVideo(true), 350)
        return () => window.clearTimeout(timer)
    }, [forcePause, videoUrl])

    const toggleAudio = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    // Handle Play/Pause
    useEffect(() => {
        if (videoRef.current) {
            if (forcePause) {
                videoRef.current.pause()
            } else {
                videoRef.current.play().catch(e => console.log('Autoplay prevented', e))
            }
        }
    }, [forcePause, showVideo])

    if (!videoUrl) {
        return (
            <div className="absolute inset-0 z-0">
                {posterUrl && (
                    <Image
                        src={posterUrl}
                        alt="Event Background"
                        fill
                        sizes="100vw"
                        className="object-cover opacity-90"
                        priority={!forcePause} // Prioritize if this is the active/first item
                    />
                )}
            </div>
        )
    }

    return (
        <motion.div className="absolute inset-0 z-0" layoutId={layoutId}>
            {/* Poster Image (Always visible as base/fallback) */}
            {posterUrl && (
                <Image
                    src={posterUrl}
                    alt="Event Background"
                    fill
                    sizes="100vw"
                    className="object-cover opacity-90 transition-opacity duration-1000"
                    priority={!forcePause}
                />
            )}

            {/* Video (Only render when active) */}
            {!forcePause && showVideo && (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="absolute inset-0 w-full h-full object-cover opacity-100 transition-opacity duration-1000 animate-fade-in"
                    loop
                    muted={isMuted}
                    playsInline
                    autoPlay
                    preload="none"
                    poster={posterUrl || undefined}
                />
            )}

            {/* Audio Toggle (Only show if active) */}
            {!forcePause && videoUrl && (
                <button
                    onClick={toggleAudio}
                    type="button"
                    aria-pressed={!isMuted}
                    className="absolute top-4 right-4 md:top-8 md:right-8 z-20 w-9 h-9 rounded-full border border-black/[0.06] bg-white/90 text-black shadow-sm backdrop-blur-md flex items-center justify-center hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-white/10 dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-800/90 dark:focus-visible:ring-white"
                    aria-label={isMuted ? "Unmute video" : "Mute video"}
                >
                    {isMuted ? (
                        <VolumeX aria-hidden="true" className="w-4 h-4" />
                    ) : (
                        <Volume2 aria-hidden="true" className="w-4 h-4" />
                    )}
                </button>
            )}
        </motion.div>
    )
}
