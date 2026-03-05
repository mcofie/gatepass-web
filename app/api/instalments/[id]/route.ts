import { NextResponse } from 'next/server'
import { getInstalmentReservation } from '@/utils/actions/instalment'

/**
 * GET /api/instalments/[id]
 * Fetches a single instalment reservation with full details
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const data = await getInstalmentReservation(id)

        if (!data) {
            return NextResponse.json({ error: 'Instalment reservation not found' }, { status: 404 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        console.error('[instalment-detail] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
