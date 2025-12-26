import { Resend } from 'resend'
import { TicketEmail } from '@/emails/TicketEmail'
import { StaffAccessEmail } from '@/emails/StaffAccessEmail'
import { TransferEmail } from '@/emails/TransferEmail'

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
    reservationId?: string
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

interface SendStaffAccessEmailProps {
    to: string
    eventName: string
    staffName: string
    accessCode: string
}

export const sendStaffAccessEmail = async (props: SendStaffAccessEmailProps) => {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
        throw new Error('RESEND_API_KEY is missing.')
    }

    const resend = new Resend(resendApiKey)

    const { data, error } = await resend.emails.send({
        from: 'GatePass Team <notifications@updates.gatepass.so>',
        to: props.to,
        subject: `Staff Access Code for ${props.eventName}`,
        react: StaffAccessEmail(props),
    })

    if (error) {
        throw new Error(`Resend Error: ${error.message}`)
    }

    return { messageId: data?.id }
}

interface SendTransferEmailProps {
    to: string
    eventName: string
    senderName: string
    claimUrl: string
    posterUrl?: string
}

export const sendTransferEmail = async (props: SendTransferEmailProps) => {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
        throw new Error('RESEND_API_KEY is missing.')
    }

    const resend = new Resend(resendApiKey)

    const { data, error } = await resend.emails.send({
        from: 'GatePass <notifications@updates.gatepass.so>',
        to: props.to,
        subject: `${props.senderName} sent you a ticket for ${props.eventName}`,
        react: TransferEmail(props),
    })

    if (error) {
        throw new Error(`Resend Error: ${error.message}`)
    }

    return { messageId: data?.id }
}
