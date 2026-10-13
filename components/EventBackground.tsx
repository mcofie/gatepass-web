'use client'

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { Volume2, VolumeX } from 'lucide-react'

// Phones get the portrait cut, larger screens the landscape one
const PHONE_QUERY = '(max-width: 767px)'
const subscribePhone = (onChange: () => void) => {
    const query = window.matchMedia(PHONE_QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false)

interface EventBackgroundProps {
    /** Landscape video, for desktop */
    videoUrl: string | null
    /** Portrait video, for phones */
    portraitVideoUrl?: string | null
    posterUrl: string | null
    forcePause?: boolean
    /** Kept for callers; shared-layout transitions are no longer used here */
    layoutId?: string
}

export function EventBackground({ videoUrl: landscapeUrl, portraitVideoUrl, posterUrl, forcePause }: EventBackgroundProps) {
    const isPhone = usePhone()
    // Phones play the portrait cut and larger screens the landscape one. With only one cut,
    // it plays everywhere, zoomed in to fill the screen (object-cover) rather than letterboxed.
    const videoUrl = (isPhone ? portraitVideoUrl || landscapeUrl : landscapeUrl || portraitVideoUrl) || null
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
        <div className="absolute inset-0 z-0">
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
                    key={videoUrl}
                    ref={videoRef}
                    src={videoUrl}
                    className="absolute inset-0 h-full w-full object-cover opacity-100 transition-opacity duration-1000 animate-fade-in"
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
        </div>
    )
}
