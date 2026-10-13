'use client'

import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import {
    DEFAULT_ORIGIN,
    embedAttributes,
    getEvent,
    loadGatePass,
    onGatePassEvent,
    openCheckout,
    type EmbedOptions,
    type GatePassEvent,
    type GatePassEventType,
    type PublicEvent,
} from '@gatepass/js'

export type { EmbedOptions, GatePassEvent, GatePassEventType, PublicEvent, PublicTicket, Theme } from '@gatepass/js'
export { getEvent, getOrganizerEvents, openCheckout } from '@gatepass/js'

const OriginContext = createContext(DEFAULT_ORIGIN)

/** Optional: point every component below at another GatePass origin (e.g. staging). */
export function GatePassProvider({ origin = DEFAULT_ORIGIN, children }: { origin?: string; children: ReactNode }) {
    return <OriginContext.Provider value={origin}>{children}</OriginContext.Provider>
}

// `ref` is reserved by React, so the referral tag is passed as `referral`
type Options = Omit<EmbedOptions, 'ref'> & { referral?: string }

type WidgetProps = Options & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Event slug, e.g. "99-problems" */
    event: string
}

/** Inline checkout that sizes itself to fit. */
export function GatePassWidget({ event, theme, view, referral, ...rest }: WidgetProps) {
    const origin = useContext(OriginContext)
    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = container.current
        if (!el) return
        let cancelled = false
        el.removeAttribute('data-gatepass-mounted')
        el.innerHTML = ''
        loadGatePass(origin).then(gatepass => { if (!cancelled) gatepass.mount(el.parentNode ?? undefined) }).catch(console.error)
        return () => {
            cancelled = true
            el.innerHTML = ''
            el.removeAttribute('data-gatepass-mounted')
        }
    }, [origin, event, theme, view, referral])

    return <div ref={container} {...rest} {...embedAttributes(event, { theme, view, ref: referral })} />
}

type ButtonProps = Options & ButtonHTMLAttributes<HTMLButtonElement> & {
    event: string
    children?: ReactNode
}

/** A button that opens checkout in a pop-up over your page. Style it like any button. */
export function GatePassButton({ event, theme, view, referral, children = 'Buy tickets', onClick, ...rest }: ButtonProps) {
    const origin = useContext(OriginContext)
    // Warm the loader so the first click opens instantly
    useEffect(() => { loadGatePass(origin).catch(() => { /* retried on click */ }) }, [origin])
    return (
        <button
            type="button"
            {...rest}
            onClick={e => {
                onClick?.(e)
                if (!e.defaultPrevented) openCheckout(event, { theme, view, ref: referral }, origin).catch(console.error)
            }}
        >
            {children}
        </button>
    )
}

/** Public event data (title, dates, venue, ticket prices and availability). */
export function useGatePassEvent(slug: string | null | undefined) {
    const origin = useContext(OriginContext)
    const [state, setState] = useState<{ data: PublicEvent | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: !!slug })

    useEffect(() => {
        if (!slug) return
        const controller = new AbortController()
        getEvent(slug, { origin, signal: controller.signal })
            .then(data => setState({ data, error: null, loading: false }))
            .catch(error => { if (!controller.signal.aborted) setState({ data: null, error, loading: false }) })
        return () => controller.abort()
    }, [slug, origin])

    return state
}

/** Run a callback for checkout events from any GatePass widget or button on the page. */
export function useGatePassListener(type: GatePassEventType, handler: (event: GatePassEvent) => void) {
    const origin = useContext(OriginContext)
    const latest = useRef(handler)
    useEffect(() => { latest.current = handler })
    useEffect(() => onGatePassEvent(type, e => latest.current(e), origin), [type, origin])
}
