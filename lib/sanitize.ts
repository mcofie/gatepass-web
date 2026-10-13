import sanitizeHtml from 'sanitize-html'

// Pure-JS sanitizer: no jsdom, so it runs in any server runtime (and in the browser for previews)
const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'mark', 'span',
        'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'hr',
        'ul', 'ol', 'li', 'a',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
    },
}

/** Event descriptions are organizer-written rich text: clean them on the server, before they reach a browser. */
export function sanitizeDescription(html: string | null | undefined): string {
    return sanitizeHtml(html ?? '', OPTIONS)
}

export function withSafeDescription<T extends { description?: string | null }>(event: T): T {
    return { ...event, description: sanitizeDescription(event.description) }
}
