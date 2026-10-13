'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendTransferEmail } from '@/utils/email'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so').replace(/\/$/, '')
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PendingTransfer = {
    id: string
    url: string
    recipientEmail: string | null
    expiresAt: string
}

type Result<T = object> = ({ success: true } & T) | { success: false; message: string }

type OwnedTicket = {
    id: string
    status: string
    user_id: string
    ticket_tiers: { is_virtual: boolean | null } | null
    events: { title: string; poster_url: string | null; starts_at: string; ends_at: string | null } | null
}

const claimUrl = (token: string) => `${SITE_URL}/claim/${token}`

const toPending = (row: { id: string; claim_token: string; recipient_email: string | null; expires_at: string }): PendingTransfer => ({
    id: row.id,
    url: claimUrl(row.claim_token),
    recipientEmail: row.recipient_email,
    expiresAt: row.expires_at,
})

/** Masks an email for display to someone holding the link: ama.mensah@gmail.com → am•••@gmail.com */
function maskEmail(email: string) {
    const [name, domain] = email.split('@')
    return `${name.slice(0, 2)}•••@${domain}`
}

async function getOwnedTicket(ticketId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sign in to transfer tickets' as const }

    const { data } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('id, status, user_id, ticket_tiers(is_virtual), events(title, poster_url, starts_at, ends_at)')
        .eq('id', ticketId)
        .eq('user_id', user.id)
        .maybeSingle()

    const ticket = data as unknown as OwnedTicket | null
    if (!ticket) return { error: 'Ticket not found' as const }
    if (ticket.status !== 'valid') return { error: 'Only valid tickets can be transferred' as const }
    if (ticket.ticket_tiers?.is_virtual) return { error: 'Online passes can’t be transferred' as const }
    const end = ticket.events ? new Date(ticket.events.ends_at ?? new Date(ticket.events.starts_at).getTime() + 12 * 3600_000).getTime() : 0
    if (end && end < Date.now()) return { error: 'This event has ended' as const }

    return { supabase, user, ticket }
}

/** The live transfer link for a ticket, if the owner already started one. */
export async function getPendingTransfer(ticketId: string): Promise<PendingTransfer | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .select('id, claim_token, recipient_email, expires_at')
        .eq('ticket_id', ticketId)
        .eq('sender_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

    return data ? toPending(data) : null
}

/**
 * Starts a transfer: one live link per ticket, so any earlier link stops working.
 * With an email, only that address can claim it, and we email them the link.
 */
export async function startTransfer(ticketId: string, recipientEmail?: string): Promise<Result<{ transfer: PendingTransfer; emailSent?: boolean }>> {
    const owned = await getOwnedTicket(ticketId)
    if ('error' in owned) return { success: false, message: owned.error! }
    const { supabase, user, ticket } = owned

    const email = recipientEmail?.trim().toLowerCase() || null
    if (email && !EMAIL_PATTERN.test(email)) return { success: false, message: 'Enter a valid email address' }
    if (email && email === user.email?.toLowerCase()) return { success: false, message: 'That’s your own email. Enter your friend’s instead.' }

    await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('ticket_id', ticketId)
        .eq('sender_id', user.id)
        .eq('status', 'pending')

    const { data, error } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .insert({ ticket_id: ticketId, sender_id: user.id, recipient_email: email, claim_token: randomBytes(32).toString('hex'), status: 'pending' })
        .select('id, claim_token, recipient_email, expires_at')
        .single()

    if (error || !data) {
        console.error('Create transfer failed:', error)
        return { success: false, message: 'Could not start the transfer. Try again.' }
    }

    const transfer = toPending(data)
    revalidatePath('/my-tickets')

    if (!email) return { success: true, transfer }

    const { data: profile } = await supabase.schema('gatepass').from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    try {
        await sendTransferEmail({
            to: email,
            eventName: ticket.events?.title || 'an upcoming event',
            senderName: profile?.full_name || user.email || 'A friend',
            claimUrl: transfer.url,
            posterUrl: ticket.events?.poster_url ?? undefined,
        })
        return { success: true, transfer, emailSent: true }
    } catch (e) {
        console.error('Transfer email failed:', e)
        return { success: true, transfer, emailSent: false }
    }
}

export async function cancelTransfer(transferId: string): Promise<Result> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Sign in to manage transfers' }

    const { data, error } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', transferId)
        .eq('sender_id', user.id)
        .eq('status', 'pending')
        .select('id')

    if (error || !data?.length) return { success: false, message: 'This transfer was already claimed or cancelled' }
    revalidatePath('/my-tickets')
    return { success: true }
}

export type TransferPreview = {
    status: 'pending' | 'claimed' | 'cancelled' | 'expired'
    senderId: string
    senderName: string
    recipientHint: string | null
    expiresAt: string
    event: { title: string; poster_url: string | null; starts_at: string; venue_name: string | null } | null
    tierName: string | null
}

/** What the claim page shows. Read on the server, since transfers aren't publicly readable. */
export async function getTransferByToken(token: string): Promise<Result<{ transfer: TransferPreview }>> {
    if (!/^[a-f0-9]{64}$/.test(token)) return { success: false, message: 'This transfer link isn’t valid.' }

    const admin = createAdminClient()
    const { data } = await admin
        .schema('gatepass')
        .from('ticket_transfers')
        .select('status, sender_id, recipient_email, expires_at, tickets(events(title, poster_url, starts_at, venue_name), ticket_tiers(name))')
        .eq('claim_token', token)
        .maybeSingle()

    if (!data) return { success: false, message: 'This transfer link isn’t valid.' }

    const { data: sender } = await admin.schema('gatepass').from('profiles').select('full_name').eq('id', data.sender_id).maybeSingle()
    const ticket = data.tickets as unknown as { events: TransferPreview['event']; ticket_tiers: { name: string } | null } | null
    const expired = data.status === 'pending' && new Date(data.expires_at).getTime() < Date.now()

    return {
        success: true,
        transfer: {
            status: expired ? 'expired' : data.status as TransferPreview['status'],
            senderId: data.sender_id,
            senderName: sender?.full_name || 'A friend',
            recipientHint: data.recipient_email ? maskEmail(data.recipient_email) : null,
            expiresAt: data.expires_at,
            event: ticket?.events ?? null,
            tierName: ticket?.ticket_tiers?.name ?? null,
        },
    }
}

export async function claimTransferAction(token: string): Promise<Result<{ ticketId: string }> & { redirect?: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: 'Sign in to claim this ticket', redirect: true }

    const { data, error } = await supabase.rpc('claim_transfer', {
        p_token: token,
        p_new_qr_hash: randomBytes(32).toString('hex'),
    })

    if (error) {
        console.error('Claim failed:', error.message)
        return { success: false, message: 'Could not claim the ticket. Try again.' }
    }
    if (!data?.success) return { success: false, message: data?.error || 'Could not claim the ticket' }

    revalidatePath('/my-tickets')
    return { success: true, ticketId: data.ticketId }
}
