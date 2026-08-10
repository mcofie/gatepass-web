import { NextResponse } from 'next/server'

/**
 * Paystack payment verification.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { reference } = body

        if (!reference) {
            return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://gatepass.so'
        const targetUrl = `${siteUrl}/api/paystack/verify`

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie')! } : {})
            },
            body: JSON.stringify(body)
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)

    } catch (error: any) {
        console.error('Payment Verify Router Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
