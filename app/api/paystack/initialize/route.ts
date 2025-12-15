import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const { email, amount, currency, reservationId, callbackUrl } = await req.json()

        if (!email || !amount || !reservationId || !callbackUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY
        if (!secretKey) {
            console.error('PAYSTACK_SECRET_KEY missing')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Initialize transaction with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                amount, // in kobo/pesewas
                currency,
                reference: reservationId, // Use reservationId as reference for easy tracking
                callback_url: callbackUrl,
                metadata: {
                    reservationId,
                    custom_fields: [
                        {
                            display_name: "Reservation ID",
                            variable_name: "reservation_id",
                            value: reservationId
                        }
                    ]
                }
            })
        })

        const data = await response.json()

        if (!response.ok || !data.status) {
            console.error('Paystack Initialize Error:', data)
            return NextResponse.json({ error: data.message || 'Failed to initialize payment' }, { status: 400 })
        }

        return NextResponse.json(data.data) // Contains authorization_url, access_code, etc.

    } catch (error: any) {
        console.error('Initialization Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
