'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

// Wallet passes only open on iPhone, iPad and Mac
const isApplePlatform = () => /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(navigator.userAgent)
const noop = () => () => {}

/** "Add to Apple Wallet" for one entry ticket. Renders nothing off Apple devices. */
export function AddToAppleWallet({ ticketId, className, newTab = false }: {
    ticketId: string
    className?: string
    /** Embeds open the pass outside the iframe */
    newTab?: boolean
}) {
    const show = useSyncExternalStore(noop, isApplePlatform, () => false)
    if (!show) return null

    return (
        <a
            href={`/api/wallet/apple?ticketId=${encodeURIComponent(ticketId)}`}
            {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            data-html2canvas-ignore="true"
            className={cn(
                'inline-flex h-11 items-center justify-center gap-2.5 rounded-xl bg-black px-4 text-[13px] font-semibold text-white ring-1 ring-white/15 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-white',
                className,
            )}
        >
            <WalletGlyph />
            Add to Apple Wallet
        </a>
    )
}

function WalletGlyph() {
    return (
        <svg viewBox="0 0 24 20" className="h-[18px] w-[22px] shrink-0" aria-hidden="true">
            <rect x="1" y="1" width="22" height="18" rx="4" fill="#fff" />
            <rect x="1" y="3" width="22" height="4" rx="1.5" fill="#34A853" />
            <rect x="1" y="6" width="22" height="4" rx="1.5" fill="#FBBC04" />
            <rect x="1" y="9" width="22" height="4" rx="1.5" fill="#EA4335" />
            <path d="M1 12h7.5a3.5 3.5 0 0 0 7 0H23v3a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4v-3Z" fill="#d9d9d9" />
        </svg>
    )
}
