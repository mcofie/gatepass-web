import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import TicketEmail from '@/emails/TicketEmail'

export async function GET(request: Request) {
    try {
        const { sendTicketEmail } = await import('@/utils/email')

        const apiKey = process.env.RESEND_API_KEY
        const keyStatus = apiKey ? `Present (Starts with ${apiKey.substring(0, 4)}...)` : 'MISSING'
        console.log('Debug Email - API Key Status:', keyStatus)

        const { searchParams } = new URL(request.url)
        const to = searchParams.get('to') || 'maxcofie@gmail.com'

        const { render } = await import('@react-email/render')
        const { TicketEmail } = await import('@/emails/TicketEmail')
        const emailHtml = await render(TicketEmail({
            eventName: 'Debug Render Event',
            eventDate: 'Dec 25, 2025',
            venueName: 'Debug Venue',
            ticketType: 'VIP Debugger',
            customerName: 'Debug User',
            qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=DEBUG',
            ticketId: 'e8471b69-8260-449e-8c34-3102146312a8'
        }))

        // Also send it
        const info = await sendTicketEmail({
            to,
            eventName: 'Debug Event (Nodemailer)', // logic inside generic helper uses logic again?
            // Actually, let's just use the rendered HTML to see if it works.
            // The generic helper uses Resend's `react` prop.
            // Let's debug by checking if `render` produces output.
            eventDate: 'Dec 25, 2025',
            venueName: 'Debug Venue',
            ticketType: 'VIP Debugger',
            customerName: 'Debug User',
            qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=DEBUG',
            ticketId: 'e8471b69-8260-449e-8c34-3102146312a8'
        })

        return NextResponse.json({
            success: true,
            messageId: info.messageId,
            to,
            from: 'GatePass <notifications@updates.gatepass.so>',
            checkSpam: 'Please check your Spam and Promotions folders.',
            htmlPreview: emailHtml.substring(0, 500) + '...'
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 })
    }
}
