import QRCode from 'qrcode'

/**
 * QR images for ticket emails (email clients need a hosted image).
 * Drawn here so ticket codes are never sent to a third-party QR service.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(code)) return new Response('Invalid code', { status: 400 })
    const png = await QRCode.toBuffer(code, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
    return new Response(new Uint8Array(png), {
        headers: {
            'Content-Type': 'image/png',
            // The image for a code never changes; keep it out of shared caches
            'Cache-Control': 'private, max-age=31536000, immutable',
            'X-Robots-Tag': 'noindex',
        },
    })
}
