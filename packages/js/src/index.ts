/**
 * @gatepass/js: load GatePass checkout into any page and read public event data.
 * Framework packages (@gatepass/react, @gatepass/vue, @gatepass/nuxt) are thin wrappers over this.
 */

export const DEFAULT_ORIGIN = 'https://gatepass.so'

export type Theme = 'light' | 'dark'

export interface EmbedOptions {
    theme?: Theme
    /** Open straight on ticket selection */
    view?: 'tickets'
    /** Referral tag, shown as a source in the organizer's Marketing page */
    ref?: string
}

export type GatePassEventType = 'view' | 'checkout_started' | 'purchase_completed' | 'open' | 'close' | '*'

export interface GatePassEvent<T = Record<string, unknown>> {
    type: string
    detail: T & { event?: string }
}

/** The global the hosted loader (embed.js) installs. */
export interface GatePassGlobal {
    origin: string
    mount(root?: ParentNode): void
    open(slug: string, options?: EmbedOptions): void
    close(): void
    on(type: GatePassEventType | string, handler: (event: GatePassEvent) => void): () => void
}

declare global {
    interface Window {
        GatePass?: GatePassGlobal & { __loaded?: boolean }
    }
}

const loaders = new Map<string, Promise<GatePassGlobal>>()

/** Loads embed.js once per origin and resolves with the GatePass global. Browser only. */
export function loadGatePass(origin: string = DEFAULT_ORIGIN): Promise<GatePassGlobal> {
    if (typeof window === 'undefined') return Promise.reject(new Error('GatePass can only load in the browser'))
    if (window.GatePass?.__loaded) return Promise.resolve(window.GatePass)

    const key = origin.replace(/\/$/, '')
    const existing = loaders.get(key)
    if (existing) return existing

    const promise = new Promise<GatePassGlobal>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `${key}/embed.js`
        script.async = true
        script.onload = () => (window.GatePass ? resolve(window.GatePass) : reject(new Error('GatePass failed to initialise')))
        script.onerror = () => {
            loaders.delete(key)
            reject(new Error(`Could not load ${script.src}`))
        }
        document.head.appendChild(script)
    })
    loaders.set(key, promise)
    return promise
}

/** Opens checkout for an event in a pop-up over the current page. */
export async function openCheckout(slug: string, options: EmbedOptions = {}, origin?: string): Promise<void> {
    const gatepass = await loadGatePass(origin)
    gatepass.open(slug, options)
}

/** Subscribes to checkout events from any GatePass widget on the page. Returns an unsubscribe function. */
export function onGatePassEvent(type: GatePassEventType, handler: (event: GatePassEvent) => void, origin?: string): () => void {
    let off: (() => void) | null = null
    let cancelled = false
    loadGatePass(origin).then(gatepass => {
        if (!cancelled) off = gatepass.on(type, handler)
    }).catch(() => { /* surfaced by the widget itself */ })
    return () => {
        cancelled = true
        off?.()
    }
}

/** data-* attributes for a widget or button element, for frameworks that render their own markup. */
export function embedAttributes(slug: string, options: EmbedOptions = {}, kind: 'widget' | 'button' = 'widget'): Record<string, string> {
    return {
        [kind === 'widget' ? 'data-gatepass-event' : 'data-gatepass-button']: slug,
        ...(options.theme === 'dark' ? { 'data-theme': 'dark' } : {}),
        ...(options.view ? { 'data-view': options.view } : {}),
        ...(options.ref ? { 'data-ref': options.ref } : {}),
    }
}

// ---- Public API ----

export interface PublicTicket {
    id: string
    name: string
    description: string | null
    price: number
    currency: string
    /** Remaining tickets, or null when unlimited */
    available: number | null
    sold_out: boolean
    max_per_order: number | null
    /** Livestream or other online access */
    online: boolean
}

export interface PublicEvent {
    id: string
    slug: string
    title: string
    description: string
    starts_at: string
    ends_at: string | null
    venue: { name: string | null; address: string | null; latitude: number | null; longitude: number | null }
    image_url: string | null
    accent_color: string | null
    organizer: { name: string; handle: string | null; logo_url: string | null } | null
    on_sale: boolean
    from_price: { amount: number; currency: string } | null
    tickets: PublicTicket[]
    url: string
    checkout_url: string
    embed_url: string
}

export interface RequestOptions {
    origin?: string
    signal?: AbortSignal
}

async function getJson<T>(path: string, { origin = DEFAULT_ORIGIN, signal }: RequestOptions): Promise<T> {
    const response = await fetch(`${origin.replace(/\/$/, '')}${path}`, { signal, headers: { Accept: 'application/json' } })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || `GatePass request failed (${response.status})`)
    return body.data as T
}

/** A published event with its ticket types. */
export function getEvent(slug: string, options: RequestOptions = {}): Promise<PublicEvent> {
    return getJson<PublicEvent>(`/api/v1/events/${encodeURIComponent(slug)}`, options)
}

/** An organizer's published events, soonest first. */
export function getOrganizerEvents(handle: string, options: RequestOptions & { past?: boolean } = {}): Promise<PublicEvent[]> {
    return getJson<PublicEvent[]>(`/api/v1/organizers/${encodeURIComponent(handle)}/events${options.past ? '?past=true' : ''}`, options)
}
