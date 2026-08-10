import { NextResponse } from 'next/server'

/**
 * Paystack payment initialization.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const reservationIds = Array.isArray(body.reservationIds)
            ? body.reservationIds
            : (body.reservationId ? [body.reservationId] : [])

        if (reservationIds.length === 0) {
            return NextResponse.json({ error: 'Missing reservation IDs' }, { status: 400 })
        }

        // Route to the Paystack provider
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://gatepass.so'
        const targetUrl = `${siteUrl}/api/paystack/initialize`

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Forward cookies for auth context
                ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie')! } : {})
            },
            body: JSON.stringify(body)
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json({ ...data, gateway: 'paystack' })

    } catch (error: any) {
        console.error('Payment Router Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
