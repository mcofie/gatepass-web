import DOMPurify from 'isomorphic-dompurify'

/** Event descriptions are organizer-written rich text: clean them on the server, before they reach a browser. */
export function sanitizeDescription(html: string | null | undefined): string {
    return DOMPurify.sanitize(html ?? '')
}

export function withSafeDescription<T extends { description?: string | null }>(event: T): T {
    return { ...event, description: sanitizeDescription(event.description) }
}
