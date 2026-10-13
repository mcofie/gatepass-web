import { NextResponse } from 'next/server'
import { buildTicketPass, WalletPassError } from '@/lib/wallet/pass'

export const runtime = 'nodejs'

/** GET /api/wallet/apple?ticketId=… → signed Apple Wallet pass for that ticket. */
export async function GET(req: Request) {
    const ticketId = new URL(req.url).searchParams.get('ticketId')
    if (!ticketId || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
        return NextResponse.json({ error: 'Missing or invalid ticketId' }, { status: 400 })
    }

    try {
        const { buffer, filename } = await buildTicketPass(ticketId)
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        // Livestream tickets have no door code; show the ticket page with the stream instead
        if (error instanceof WalletPassError && error.code === 'virtual') {
            return NextResponse.redirect(new URL(`/ticket/${ticketId}`, req.url))
        }
        if (error instanceof WalletPassError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error('[wallet/apple]', error)
        return NextResponse.json({ error: 'Could not create the Wallet pass' }, { status: 500 })
    }
}
