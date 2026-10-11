import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { loadOgFonts, ogMarkSrc } from '@/lib/og-brand'

export const runtime = 'nodejs'
export const alt = 'Event tickets on GatePass'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 300

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const fonts = await loadOgFonts()
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    let query = supabase.schema('gatepass').from('events').select('title, starts_at, venue_name, poster_url')
    query = isUuid ? query.eq('id', slug) : query.eq('slug', slug)
    const { data: event } = await query.single()

    const title = event?.title || 'Discover your next event'
    const date = event?.starts_at && !Number.isNaN(new Date(event.starts_at).getTime())
        ? new Date(event.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Accra' })
        : null

    let posterSrc: string | null = null
    if (event?.poster_url) {
        try {
            const poster = await fetch(event.poster_url, { next: { revalidate: 300 } })
            const mimeType = poster.headers.get('content-type')?.split(';')[0] || ''
            if (poster.ok && /^image\/(png|jpeg|webp|gif)$/.test(mimeType)) {
                const bytes = await poster.arrayBuffer()
                if (bytes.byteLength < 8_000_000) {
                    posterSrc = `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
                }
            }
        } catch {
            // The branded preview still renders if the poster is temporarily unavailable.
        }
    }

    return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f7f7f5', color: '#0b0b0b', fontFamily: 'Geist' }}>
            <div style={{ width: 730, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 58px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img src={ogMarkSrc} alt="" width={52} height={52} />
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1.2 }}>GatePass</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#777' }}>Event</span>
                    <span style={{ fontSize: title.length > 36 ? 58 : 82, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3.5, overflowWrap: 'break-word' }}>{title.length > 75 ? `${title.slice(0, 72)}…` : title}</span>
                    {(date || event?.venue_name) && (
                        <span style={{ fontSize: 26, color: '#555', lineHeight: 1.3 }}>
                            {[date, event?.venue_name].filter(Boolean).join(' · ')}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', borderTop: '1px solid #d1d1cf', paddingTop: 20, fontSize: 22, fontWeight: 600 }}>
                    Get tickets on GatePass
                </div>
            </div>

            <div style={{ width: 470, height: '100%', display: 'flex', background: '#101010', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {posterSrc ? (
                    <img src={posterSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center', transform: 'scale(1.25)', transformOrigin: 'right center' }} />
                ) : (
                    <span style={{ fontSize: 180, fontWeight: 700, color: '#fff', letterSpacing: -12 }}>{title.slice(0, 2).toUpperCase()}</span>
                )}
            </div>
        </div>,
        { ...size, fonts }
    )
}
