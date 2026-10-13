import { NextResponse } from 'next/server'
import { getPublicEvent, PUBLIC_CORS_HEADERS } from '@/lib/public-api/events'

/** GET /api/v1/events/:slug → a published event with its ticket types. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const event = await getPublicEvent(slug)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404, headers: PUBLIC_CORS_HEADERS })
    return NextResponse.json({ data: event }, { headers: PUBLIC_CORS_HEADERS })
}

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS })
}
