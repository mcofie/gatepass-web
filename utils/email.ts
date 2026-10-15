import { Resend } from 'resend'
import { TicketEmail } from '@/emails/TicketEmail'
import { StaffAccessEmail } from '@/emails/StaffAccessEmail'
import { TransferEmail } from '@/emails/TransferEmail'
import { VirtualLinkEmail } from '@/emails/VirtualLinkEmail'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'

/**
 * Sends through the organizer's own email provider when they've connected one (from their domain),
 * otherwise through GatePass's Resend account. If the organizer's provider fails, GatePass sends it
 * instead, so buyers always get their tickets.
 */
async function deliver(input: { organizerId?: string | null; organizerName?: string | null; to: string; subject: string; react: ReactElement }): Promise<{ messageId?: string; via: string }> {
    if (input.organizerId) {
        const { getOrganizerEmailIntegration, sendEmail } = await import('@/lib/integrations/email')
        const integration = await getOrganizerEmailIntegration(input.organizerId).catch(() => null)
        if (integration) {
            const [html, text] = await Promise.all([render(input.react), render(input.react, { plainText: true })])
            const result = await sendEmail(integration, { to: input.to, subject: input.subject, html, text, fromName: integration.credentials.from_name || input.organizerName || undefined })
            if (result.success) return { via: integration.provider }
            console.error(`[email] ${integration.provider} failed, falling back to GatePass:`, result.error)
        }
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) throw new Error('RESEND_API_KEY is missing. Please check env vars.')
    const { data, error } = await new Resend(resendApiKey).emails.send({
        from: 'GatePass <notifications@updates.gatepass.so>',
        to: input.to,
        subject: input.subject,
        react: input.react,
    })
    if (error) throw new Error(`Resend Error: ${error.message}`)
    return { messageId: data?.id, via: 'gatepass' }
}

interface TicketGroup {
    tierName: string
    isVirtual?: boolean
    virtualLink?: string | null
    virtualInstructions?: string | null
    tickets: {
        id: string
        qrCodeUrl: string
    }[]
}

interface SendTicketEmailProps {
    to: string
    eventName: string
    eventDate: string
    venueName: string
    ticketType?: string // Now optional for multi-tier orders
    customerName: string
    qrCodeUrl?: string
    ticketId?: string
    posterUrl?: string
    tickets?: {
        id: string
        qrCodeUrl: string
        type: string
        isVirtual?: boolean
        virtualLink?: string | null
        virtualInstructions?: string | null
    }[]
    ticketGroups?: TicketGroup[] // NEW: For consolidated multi-tier emails
    reservationId?: string
    /** Sends through this organizer's email provider when they've connected one */
    organizerId?: string | null
    organizerName?: string | null
}

export const sendTicketEmail = async (props: SendTicketEmailProps) => {
    const { organizerId, organizerName, ...emailProps } = props
    return deliver({ organizerId, organizerName, to: props.to, subject: `Your tickets for ${props.eventName}`, react: TicketEmail(emailProps) })
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

interface SendVirtualLinkEmailProps {
    to: string
    eventName: string
    customerName: string
    virtualLink: string
    virtualInstructions?: string | null
    posterUrl?: string | null
    organizerId?: string | null
    organizerName?: string | null
}

export const sendVirtualLinkEmail = async (props: SendVirtualLinkEmailProps) => {
    const { organizerId, organizerName, ...emailProps } = props
    return deliver({ organizerId, organizerName, to: props.to, subject: `Livestream details: ${props.eventName}`, react: VirtualLinkEmail(emailProps) })
}
