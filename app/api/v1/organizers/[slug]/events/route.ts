import { NextResponse } from 'next/server'
import { listPublicEvents, PUBLIC_CORS_HEADERS } from '@/lib/public-api/events'

/** GET /api/v1/organizers/:handle/events?past=true → an organizer's published events, soonest first. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const includePast = new URL(req.url).searchParams.get('past') === 'true'
    const events = await listPublicEvents({ organizerHandle: slug, includePast, limit: 50 })
    return NextResponse.json({ data: events }, { headers: PUBLIC_CORS_HEADERS })
}

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS })
}
