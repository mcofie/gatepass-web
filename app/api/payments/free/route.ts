import { NextResponse } from 'next/server'
import { completeFreeOrder, PaymentProviderError } from '@/lib/payments'
import { processSuccessfulPayment } from '@/utils/actions/payment'

/** POST /api/payments/free { reservationIds } → tickets for an order that costs nothing. */
export async function POST(req: Request) {
    try {
        const { reservationIds } = await req.json()
        if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
            return NextResponse.json({ error: 'Missing reservation IDs' }, { status: 400 })
        }

        const { reference, transaction } = await completeFreeOrder(reservationIds)
        const result = await processSuccessfulPayment(reference, reservationIds, transaction)
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

        if (result.tickets) {
            result.tickets = result.tickets.map(ticket => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { reservations, ...rest } = ticket as typeof ticket & { reservations?: unknown }
                return rest as typeof ticket
            })
        }
        return NextResponse.json(result)
    } catch (error) {
        console.error('[payments/free]', error)
        const message = error instanceof Error ? error.message : 'Could not complete the order'
        return NextResponse.json({ error: message }, { status: error instanceof PaymentProviderError ? 400 : 500 })
    }
}
