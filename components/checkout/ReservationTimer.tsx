'use client'

import { useEffect, useState } from 'react'
import { Clock, RotateCcw } from 'lucide-react'

export type ReservationCountdown = {
    /** Whole seconds left, or null before there is a reservation */
    seconds: number | null
    /** "4:07" */
    label: string
    expired: boolean
}

const secondsUntil = (expiresAt: string) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

/** Counts down to a reservation's expires_at, updating every second from the first render. */
export function useReservationCountdown(expiresAt: string | null | undefined): ReservationCountdown {
    const [seconds, setSeconds] = useState<number | null>(() => (expiresAt ? secondsUntil(expiresAt) : null))
    const [trackedExpiry, setTrackedExpiry] = useState(expiresAt)

    // A new reservation restarts the countdown (adjusting state during render, not in an effect)
    if (trackedExpiry !== expiresAt) {
        setTrackedExpiry(expiresAt)
        setSeconds(expiresAt ? secondsUntil(expiresAt) : null)
    }

    useEffect(() => {
        if (!expiresAt) return
        const timer = setInterval(() => {
            const left = secondsUntil(expiresAt)
            setSeconds(left)
            if (left === 0) clearInterval(timer)
        }, 1000)
        return () => clearInterval(timer)
    }, [expiresAt])

    const s = seconds ?? 0
    return {
        seconds,
        label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
        expired: seconds === 0,
    }
}

/** Banner shown above checkout while tickets are held. */
export function ReservationTimer({ countdown, onRestart, tone = 'auto' }: {
    countdown: ReservationCountdown
    onRestart?: () => void
    /** Force colours for screens with a fixed background (e.g. the dark checkout page) */
    tone?: 'auto' | 'dark'
}) {
    if (countdown.seconds === null) return null
    const urgent = !countdown.expired && countdown.seconds <= 60

    if (countdown.expired) {
        return (
            <div role="alert" className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${tone === 'dark'
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'}`}>
                <span className="flex items-center gap-2"><Clock className="size-4 shrink-0" aria-hidden="true" /> Your hold on these tickets has ended.</span>
                {onRestart && (
                    <button type="button" onClick={onRestart} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 dark:bg-white/10 font-semibold underline-offset-4 hover:underline">
                        <RotateCcw className="size-3.5" aria-hidden="true" /> Start again
                    </button>
                )}
            </div>
        )
    }

    return (
        <div
            role="timer"
            aria-live={urgent ? 'assertive' : 'off'}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${urgent
                ? (tone === 'dark' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200')
                : (tone === 'dark' ? 'border-white/10 bg-white/5 text-white/80' : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300')}`}
        >
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            <span>
                {urgent ? 'Almost out of time. ' : ''}Tickets held for <span className="font-semibold tabular-nums">{countdown.label}</span>
            </span>
        </div>
    )
}
