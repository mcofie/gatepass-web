'use client'

import { LazyMotion } from 'framer-motion'

// Animation features (including shared layout) load as a separate chunk after the page renders,
// so public pages ship only the small `m` components up front.
const loadFeatures = () => import('./features').then(mod => mod.default)

export function LazyMotionProvider({ children }: { children: React.ReactNode }) {
    return <LazyMotion features={loadFeatures}>{children}</LazyMotion>
}
