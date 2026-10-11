'use client'

import React, { useState, useRef } from 'react'
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
    const videoRef = useRef<HTMLVideoElement>(null)

    const toggleAudio = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    // Handle Play/Pause
    React.useEffect(() => {
        if (videoRef.current) {
            if (forcePause) {
                videoRef.current.pause()
            } else {
                videoRef.current.play().catch(e => console.log('Autoplay prevented', e))
            }
        }
    }, [forcePause])

    if (!videoUrl) {
        return (
            <div className="absolute inset-0 z-0">
                {posterUrl && (
                    <Image
                        src={posterUrl}
                        alt="Event Background"
                        fill
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
                    className="object-cover opacity-90 transition-opacity duration-1000"
                    priority={!forcePause}
                />
            )}

            {/* Video (Only render when active) */}
            {!forcePause && videoUrl && (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="absolute inset-0 w-full h-full object-cover opacity-100 transition-opacity duration-1000 animate-fade-in"
                    loop
                    muted={isMuted}
                    playsInline
                    autoPlay
                    poster={posterUrl || undefined}
                />
            )}

            {/* Audio Toggle (Only show if active) */}
            {!forcePause && videoUrl && (
                <button
                    onClick={toggleAudio}
                    type="button"
                    aria-pressed={!isMuted}
                    className="absolute top-4 right-4 md:top-8 md:right-8 z-20 w-9 h-9 bg-white/95 backdrop-blur-md border border-black/5 rounded-full shadow-sm flex items-center justify-center text-black hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
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
