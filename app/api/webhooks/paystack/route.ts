import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 })

    // 1. Validate Signature
    const signature = request.headers.get('x-paystack-signature')
    const body = await request.text()
    const hash = crypto.createHmac('sha512', secret).update(body).digest('hex')

    if (hash !== signature) {
        return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 })
    }

    const event = JSON.parse(body)

    // 2. Handle 'charge.success'
    if (event.event === 'charge.success') {
        const { reference, metadata } = event.data

        // In our flow, reference IS the reservationId (set during initialize).
        // But we also pass it in metadata for safety.
        const reservationId = metadata?.reservationId || reference

        console.log(`Webhook: Processing payment for Reservation ${reservationId} (Ref: ${reference})`)

        const { processSuccessfulPayment } = await import('@/utils/actions/payment')
        const result = await processSuccessfulPayment(reference, reservationId, event.data)

        if (!result.success) {
            console.error('Webhook Payment Processing Failed:', result.error)
            // Return 200 to acknowledge receipt to Paystack, even if processing failed locally
            // to prevent them from retrying infinitely for a logic error (e.g. reservation deleted).
            // Unless it's a transient error, but better safe to stop the loop.
            return NextResponse.json({ received: true, error: result.error }, { status: 200 })
        }

        console.log('Webhook Payment Processed Successfully')
    }

    return NextResponse.json({ received: true })
}
