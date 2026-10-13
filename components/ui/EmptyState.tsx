'use client'

import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Empty states with a quiet, grainy grey illustration: flat shapes, soft shadow,
 * and a dashed path. Colours come from currentColor-free greys that read in light and dark.
 */

export type EmptyIllustration = 'suitcase' | 'ticket' | 'calendar' | 'receipt' | 'form' | 'gift' | 'megaphone'

// Greys tuned to sit on white and on near-black
const C = {
    base: 'fill-gray-200 dark:fill-zinc-700',
    mid: 'fill-gray-300 dark:fill-zinc-600',
    dark: 'fill-gray-400 dark:fill-zinc-500',
    ink: 'fill-gray-500 dark:fill-zinc-400',
    light: 'fill-gray-100 dark:fill-zinc-800',
    line: 'stroke-gray-500 dark:stroke-zinc-400',
    shadow: 'fill-gray-300/60 dark:fill-black/40',
}

function Grain({ id }: { id: string }) {
    return (
        <filter id={id} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0" result="grain" />
            <feComposite in="grain" in2="SourceGraphic" operator="in" result="clipped" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="clipped" /></feMerge>
        </filter>
    )
}

function Shadow() {
    return <ellipse cx="120" cy="196" rx="74" ry="8" className={C.shadow} />
}

function Dashes({ d }: { d: string }) {
    return <path d={d} className={C.line} strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" fill="none" />
}

const ART: Record<EmptyIllustration, (grain: string) => React.ReactNode> = {
    suitcase: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`}>
                <rect x="96" y="22" width="34" height="10" rx="5" className={C.ink} />
                <rect x="100" y="28" width="5" height="40" className={C.mid} />
                <rect x="121" y="28" width="5" height="40" className={C.mid} />
                <rect x="72" y="66" width="72" height="120" rx="14" className={C.base} />
                <rect x="86" y="70" width="56" height="112" rx="10" className={C.dark} />
                <rect x="148" y="68" width="62" height="116" rx="16" className={C.light} />
                <path d="M152 74h26a10 10 0 0 1 10 10v20h-36z" className={C.mid} />
                <rect x="76" y="112" width="4" height="22" rx="2" className={C.light} />
                <circle cx="92" cy="190" r="6" className={C.mid} /><circle cx="128" cy="190" r="6" className={C.mid} />
            </g>
            <Dashes d="M92 160c20 10 40 6 58-8s34-16 42-6" />
            <path d="M188 138l10-6 2 8z" className={C.ink} />
        </>
    ),
    ticket: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`} transform="rotate(-8 120 110)">
                <path d="M58 64h124a8 8 0 0 1 8 8v18a14 14 0 0 0 0 28v18a8 8 0 0 1-8 8H58a8 8 0 0 1-8-8v-18a14 14 0 0 0 0-28V72a8 8 0 0 1 8-8z" className={C.base} />
                <rect x="70" y="80" width="64" height="8" rx="4" className={C.dark} />
                <rect x="70" y="96" width="44" height="6" rx="3" className={C.mid} />
                <rect x="70" y="124" width="30" height="16" rx="4" className={C.ink} />
                <path d="M150 70v76" className={C.line} strokeWidth="2" strokeDasharray="3 5" />
                <rect x="160" y="90" width="18" height="36" rx="3" className={C.light} />
            </g>
            <Dashes d="M64 176c18-12 44-14 64-2s40 10 54-4" />
        </>
    ),
    calendar: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`}>
                <rect x="62" y="44" width="116" height="132" rx="16" className={C.base} />
                <path d="M62 60a16 16 0 0 1 16-16h84a16 16 0 0 1 16 16v20H62z" className={C.dark} />
                <rect x="86" y="32" width="8" height="24" rx="4" className={C.ink} /><rect x="146" y="32" width="8" height="24" rx="4" className={C.ink} />
                {[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => (
                    <rect key={`${r}${c}`} x={78 + c * 22} y={94 + r * 19} width="14" height="12" rx="3" className={r === 1 && c === 2 ? C.ink : C.light} />
                )))}
            </g>
            <Dashes d="M150 120c26-6 40 12 46 30" />
            <circle cx="196" cy="152" r="5" className={C.ink} />
        </>
    ),
    receipt: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`}>
                <path d="M78 30h84v150l-10-8-11 8-11-8-10 8-11-8-10 8-11-8-10 8z" className={C.base} />
                <rect x="92" y="50" width="56" height="8" rx="4" className={C.dark} />
                {[0, 1, 2, 3].map(i => <rect key={i} x="92" y={72 + i * 16} width={i % 2 ? 34 : 46} height="6" rx="3" className={C.mid} />)}
                <rect x="92" y="142" width="56" height="12" rx="4" className={C.ink} />
            </g>
            <Dashes d="M166 70c22 4 34 20 30 42" />
            <circle cx="194" cy="118" r="11" className={C.light} /><path d="M190 118h8M194 114v8" className={C.line} strokeWidth="2.5" strokeLinecap="round" />
        </>
    ),
    form: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`}>
                <rect x="70" y="40" width="100" height="140" rx="14" className={C.base} />
                <rect x="96" y="30" width="48" height="20" rx="8" className={C.dark} />
                {[0, 1, 2].map(i => (
                    <g key={i}>
                        <rect x="86" y={70 + i * 32} width="14" height="14" rx="4" className={i === 0 ? C.ink : C.light} />
                        <rect x="108" y={73 + i * 32} width={i === 1 ? 34 : 46} height="8" rx="4" className={C.mid} />
                    </g>
                ))}
            </g>
            <Dashes d="M174 150c18-4 28-20 24-40" />
            <path d="M194 104l8-12 6 14z" className={C.ink} />
        </>
    ),
    gift: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`}>
                <rect x="72" y="92" width="96" height="88" rx="10" className={C.base} />
                <rect x="64" y="72" width="112" height="28" rx="8" className={C.light} />
                <rect x="112" y="72" width="16" height="108" className={C.dark} />
                <path d="M120 72c-18-26-44-20-38-6 4 9 22 8 38 6zM120 72c18-26 44-20 38-6-4 9-22 8-38 6z" className={C.ink} />
            </g>
            <Dashes d="M176 128c18-2 26-18 20-34" />
            <circle cx="194" cy="88" r="4" className={C.ink} />
        </>
    ),
    megaphone: g => (
        <>
            <Shadow />
            <g filter={`url(#${g})`}>
                <path d="M70 96l70-36v100l-70-36z" className={C.base} />
                <rect x="56" y="94" width="20" height="32" rx="6" className={C.dark} />
                <rect x="138" y="58" width="12" height="104" rx="6" className={C.mid} />
                <path d="M82 124l10 46h16l-8-40z" className={C.light} />
            </g>
            <Dashes d="M160 92c14-6 28-4 38 4M160 128c14 6 28 4 38-4" />
            <circle cx="200" cy="110" r="5" className={C.ink} />
        </>
    ),
}

export function EmptyState({ illustration = 'suitcase', title, description, action, className, compact = false }: {
    illustration?: EmptyIllustration
    title: string
    description?: React.ReactNode
    action?: React.ReactNode
    className?: string
    compact?: boolean
}) {
    const grainId = React.useId().replace(/:/g, '')
    return (
        <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
            <svg viewBox="0 0 240 210" aria-hidden="true" className={compact ? 'h-28 w-auto' : 'h-40 w-auto sm:h-44'}>
                <defs><Grain id={grainId} /></defs>
                {ART[illustration](grainId)}
            </svg>
            <p className="mt-5 text-lg font-semibold tracking-tight text-gray-950 dark:text-white">{title}</p>
            {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    )
}
