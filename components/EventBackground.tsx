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
    // Each screen falls back to the other cut when only one was uploaded
    const videoUrl = (isPhone ? portraitVideoUrl || landscapeUrl : landscapeUrl || portraitVideoUrl) || null
    const [isMuted, setIsMuted] = useState(true)
    const [showVideo, setShowVideo] = useState(false)
    // 'contain' when the video's shape fights the screen (portrait on a laptop, landscape on a phone),
    // so the whole frame shows over a blurred backdrop instead of a heavy crop
    const [fit, setFit] = useState<'cover' | 'contain'>('cover')
    const videoRef = useRef<HTMLVideoElement>(null)

    const updateFit = React.useCallback(() => {
        const video = videoRef.current
        if (!video?.videoWidth || !video.videoHeight) return
        const videoRatio = video.videoWidth / video.videoHeight
        const screenRatio = window.innerWidth / window.innerHeight
        // Covering would crop away more than ~40% of the frame
        setFit(Math.max(videoRatio / screenRatio, screenRatio / videoRatio) > 1.7 ? 'contain' : 'cover')
    }, [])

    useEffect(() => {
        window.addEventListener('resize', updateFit)
        return () => window.removeEventListener('resize', updateFit)
    }, [updateFit])

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

            {/* Blurred backdrop behind a letterboxed video */}
            {fit === 'contain' && !forcePause && showVideo && (
                posterUrl
                    ? <Image src={posterUrl} alt="" fill sizes="100vw" aria-hidden="true" className="scale-110 object-cover opacity-70 blur-2xl" />
                    : <div className="absolute inset-0 bg-black" aria-hidden="true" />
            )}

            {/* Video (Only render when active) */}
            {!forcePause && showVideo && (
                <video
                    key={videoUrl}
                    ref={videoRef}
                    src={videoUrl}
                    onLoadedMetadata={updateFit}
                    className={`absolute inset-0 w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} opacity-100 transition-opacity duration-1000 animate-fade-in`}
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
