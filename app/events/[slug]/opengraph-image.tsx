import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export const alt = 'Event Details'
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Check if slug is UUID or custom slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    const query = supabase
        .schema('gatepass')
        .from('events')
        .select('*, profiles!organizer_id(first_name, last_name, full_name)')

    const { data: event } = isUUID
        ? await query.eq('id', slug).single()
        : await query.eq('slug', slug).single()

    if (!event) {
        return new ImageResponse(
            (
                <div
                    style={{
                        fontSize: 40,
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontFamily: 'Inter'
                    }}
                >
                    Event Not Found
                </div>
            ),
            { ...size }
        )
    }

    const { title, starts_at, venue_name, primary_color, poster_url } = event
    const date = new Date(starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const time = new Date(starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    const themeColor = primary_color || '#000000'

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'white',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                }}
            >
                {/* Left Side: Brand & Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 60, justifyContent: 'space-between', borderRight: '1px solid #f3f4f6' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 10, background: themeColor }} />
                        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: '#111' }}>
                            GatePass.
                        </span>
                    </div>

                    {/* Main Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{
                            fontSize: 64,
                            fontWeight: 900,
                            color: '#000',
                            lineHeight: 1,
                            letterSpacing: -2,
                            // Clamp lines if too long? Not easy in OG, but flex handles wrapping
                            wordBreak: 'break-word'
                        }}>
                            {title}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: 28, color: '#6b7280' }}>🗓️</div>
                                <div style={{ fontSize: 28, fontWeight: 600, color: '#374151' }}>{date} &bull; {time}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: 28, color: '#6b7280' }}>📍</div>
                                <div style={{ fontSize: 28, fontWeight: 600, color: '#374151' }}>{venue_name}</div>
                            </div>
                        </div>
                    </div>

                    {/* Footer CTA */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px 32px',
                        background: '#f9fafb',
                        borderRadius: 100,
                        width: 'fit-content',
                        border: '1px solid #e5e7eb'
                    }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Get Tickets &rarr;</span>
                    </div>
                </div>

                {/* Right Side: Poster Image */}
                <div style={{ width: 480, height: '100%', display: 'flex', background: '#f3f4f6', position: 'relative' }}>
                    {poster_url ? (
                        <img
                            src={poster_url}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: themeColor, opacity: 0.1 }}>
                            <span style={{ fontSize: 80 }}>🎫</span>
                        </div>
                    )}

                    {/* Gradient Overlay for text readability if we put text over image (not currently) */}
                    <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 20px 0 40px rgba(255,255,255,0.5)' }} />
                </div>
            </div>
        ),
        {
            ...size,
            // Fonts would improve this, but let's stick to system sans for now or import Inter in a robust way if needed
        }
    )
}
