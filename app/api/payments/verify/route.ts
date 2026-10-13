import { NextResponse } from 'next/server'
import { confirmPayment, PaymentProviderError } from '@/lib/payments'
import { processSuccessfulPayment } from '@/utils/actions/payment'

/**
 * Confirms a payment with the organizer's provider and issues tickets.
 * Called from the buyer's return URL; the provider webhook does the same in the background.
 */
export async function POST(req: Request) {
    try {
        const { reference, addons } = await req.json()
        if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

        const confirmation = await confirmPayment(reference)
        if (confirmation.status !== 'success') {
            return NextResponse.json({ success: false, status: confirmation.status, error: confirmation.message }, { status: 400 })
        }

        // Instalment payments are settled by their own routes; never issue full tickets for a part payment
        const paymentType = (confirmation.session.metadata as { payment_type?: string }).payment_type
        if (paymentType === 'instalment' || paymentType === 'instalment_first') {
            return NextResponse.json({ success: false, error: 'This is an instalment payment' }, { status: 400 })
        }

        const result = await processSuccessfulPayment(reference, confirmation.session.reservation_ids, confirmation.transaction, addons)

        // Drop the nested reservation (circular event/organizer refs) before serialising
        if (result.tickets) {
            result.tickets = result.tickets.map(ticket => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { reservations, ...rest } = ticket as typeof ticket & { reservations?: unknown }
                return rest as typeof ticket
            })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('[payments/verify]', error)
        const message = error instanceof Error ? error.message : 'Unknown payment verification error'
        return NextResponse.json({ error: message }, { status: error instanceof PaymentProviderError ? 400 : 500 })
    }
}
