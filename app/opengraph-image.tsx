import { ImageResponse } from 'next/og'
import { loadOgFonts, ogMarkSrc } from '@/lib/og-brand'

export const runtime = 'nodejs'
export const alt = 'GatePass — discover events and get tickets'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
    const fonts = await loadOgFonts()

    return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f7f7f5', color: '#0b0b0b', padding: '56px 68px', fontFamily: 'Geist' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src={ogMarkSrc} alt="" width={60} height={60} />
                <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5 }}>GatePass</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 112, fontWeight: 700, lineHeight: 0.98, letterSpacing: -7 }}>Get in.</span>
                <span style={{ fontSize: 112, fontWeight: 700, lineHeight: 0.98, letterSpacing: -7 }}>Be there.</span>
                <span style={{ marginTop: 28, fontSize: 28, color: '#555' }}>Discover events and book your place.</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cfcfcd', paddingTop: 20, fontSize: 20, fontWeight: 600 }}>
                <span>Events worth showing up for</span>
                <span>gatepass.so</span>
            </div>
        </div>,
        { ...size, fonts }
    )
}
