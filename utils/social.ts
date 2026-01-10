/**
 * Formats social media URLs to ensure they have proper protocol and full path.
 */

/**
 * Ensures a URL has an https:// prefix
 */
export function formatWebsiteUrl(url: string | null | undefined): string | null {
    if (!url) return null
    const trimmed = url.trim()
    if (!trimmed) return null

    // Already has protocol
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed
    }

    return `https://${trimmed}`
}

/**
 * Formats Instagram handle to full URL
 * Accepts: "username", "@username", "instagram.com/username", "https://instagram.com/username"
 */
export function formatInstagramUrl(input: string | null | undefined): string | null {
    if (!input) return null
    const trimmed = input.trim()
    if (!trimmed) return null

    // Already a full URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed
    }

    // Has domain but no protocol
    if (trimmed.includes('instagram.com')) {
        return `https://${trimmed}`
    }

    // Just a username (remove @ if present)
    const username = trimmed.replace(/^@/, '')
    return `https://instagram.com/${username}`
}

/**
 * Formats Twitter/X handle to full URL
 * Accepts: "username", "@username", "twitter.com/username", "x.com/username", "https://..."
 */
export function formatTwitterUrl(input: string | null | undefined): string | null {
    if (!input) return null
    const trimmed = input.trim()
    if (!trimmed) return null

    // Already a full URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed
    }

    // Has domain but no protocol
    if (trimmed.includes('twitter.com') || trimmed.includes('x.com')) {
        return `https://${trimmed}`
    }

    // Just a username (remove @ if present)
    const username = trimmed.replace(/^@/, '')
    return `https://x.com/${username}`
}

/**
 * Formats Facebook handle to full URL
 * Accepts: "pagename", "facebook.com/pagename", "https://..."
 */
export function formatFacebookUrl(input: string | null | undefined): string | null {
    if (!input) return null
    const trimmed = input.trim()
    if (!trimmed) return null

    // Already a full URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed
    }

    // Has domain but no protocol
    if (trimmed.includes('facebook.com') || trimmed.includes('fb.com')) {
        return `https://${trimmed}`
    }

    // Just a page/username
    return `https://facebook.com/${trimmed}`
}
