import { Resend } from 'resend'
import { TicketEmail } from '@/emails/TicketEmail'

interface SendTicketEmailProps {
    to: string
    eventName: string
    eventDate: string
    venueName: string
    ticketType: string
    customerName: string
    qrCodeUrl?: string
    ticketId?: string
    posterUrl?: string
    tickets?: {
        id: string
        qrCodeUrl: string
        type: string
    }[]
}

export const sendTicketEmail = async (props: SendTicketEmailProps) => {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
        throw new Error('RESEND_API_KEY is missing. Please check env vars.')
    }

    const resend = new Resend(resendApiKey)

    const { data, error } = await resend.emails.send({
        from: 'GatePass <notifications@updates.gatepass.so>',
        to: props.to,
        subject: `Your Ticket for ${props.eventName}`,
        react: TicketEmail(props),
    })

    if (error) {
        throw new Error(`Resend Error: ${error.message}`)
    }

    return { messageId: data?.id }
}
