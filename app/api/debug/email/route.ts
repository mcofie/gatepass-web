import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import TicketEmail from '@/emails/TicketEmail'

export async function GET(request: Request) {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
        return NextResponse.json({
            success: false,
            error: 'RESEND_API_KEY is missing in environment variables.'
        }, { status: 500 })
    }

    try {
        const resend = new Resend(resendApiKey)

        // Try to send to the developer's email or a safe test email
        // We'll use a query param or default to a placeholder that might fail if not verified
        // Better: Send to 'delivered@resend.dev' which always succeeds for testing, 
        // OR ask user to provide 'to' param?
        // Let's grab 'to' from query
        const { searchParams } = new URL(request.url)
        const to = searchParams.get('to') || 'delivered@resend.dev'

        const data = await resend.emails.send({
            from: 'GatePass <onboarding@resend.dev>',
            to: [to],
            subject: 'Debug: Ticket Email Test',
            react: TicketEmail({
                eventName: 'Debug Event',
                eventDate: 'Dec 25, 2025',
                venueName: 'Debug Venue',
                ticketId: 'DBG-123',
                customerName: 'Debug User'
            })
        })

        if (data.error) {
            return NextResponse.json({ success: false, error: data.error }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 })
    }
}
