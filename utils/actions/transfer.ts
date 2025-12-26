'use server'

import { createClient } from "@/utils/supabase/server"
import { randomBytes } from "crypto"
import { sendTransferEmail } from "@/utils/email"

export async function createTransfer(ticketId: string, recipientEmail?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, message: 'Unauthorized' }
    }

    // 1. Generate Secure Token
    const token = randomBytes(32).toString('hex')

    // 2. Create Transfer Record
    const { data, error } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .insert({
            ticket_id: ticketId,
            sender_id: user.id,
            recipient_email: recipientEmail || null,
            claim_token: token,
            status: 'pending'
        })
        .select()
        .single()

    if (error) {
        console.error('Create Transfer Error:', error)
        return { success: false, message: 'Failed to create transfer link' }
    }

    return { success: true, transfer: data, token: token, message: 'Transfer link created' }
}

export async function sendTransferByEmail(ticketId: string, recipientEmail: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    // 1. Create the transfer record
    const res = await createTransfer(ticketId, recipientEmail)
    if (!res.success || !res.transfer || !res.token) return res

    // 2. Fetch extra details for the email (Event Name, Poster, Sender Name)
    const { data: ticket } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select(`
            events (
                title,
                poster_url
            )
        `)
        .eq('id', ticketId)
        .single()

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const eventName = (ticket?.events as any)?.title || 'An upcoming event'
    const posterUrl = (ticket?.events as any)?.poster_url
    const senderName = profile?.full_name || user.email || 'A friend'
    const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'}/claim/${res.token}`

    // 3. Send the email
    try {
        await sendTransferEmail({
            to: recipientEmail,
            eventName,
            senderName,
            claimUrl,
            posterUrl
        })
        return { success: true, message: 'Transfer email sent' }
    } catch (e: any) {
        console.error('Email Sending Error:', e)
        return { success: true, message: 'Transfer created, but notification email failed to send.' }
    }
}

export async function cancelTransfer(transferId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Unauthorized' }

    const { error } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .update({ status: 'cancelled' })
        .eq('id', transferId)
        .eq('sender_id', user.id)

    if (error) {
        return { success: false, message: 'Failed to cancel transfer' }
    }

    return { success: true }
}

export async function getTransferByToken(token: string) {
    const supabase = await createClient()

    // 1. Fetch the transfer record with ticket and event details
    const { data: transfer, error } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .select(`
            *,
            tickets (
                id,
                events (
                    title,
                    poster_url,
                    starts_at,
                    venue_name
                ),
                ticket_tiers (
                    name
                )
            )
        `)
        .eq('claim_token', token)
        .single()

    if (error || !transfer) {
        console.error('Get Transfer Error:', error)
        return { success: false, message: 'Invalid token' }
    }

    // 2. Fetch sender profile separately to avoid cross-schema join issues
    const { data: senderProfile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('full_name, email')
        .eq('id', transfer.sender_id)
        .single()

    return {
        success: true,
        transfer: {
            ...transfer,
            sender_name: senderProfile?.full_name || 'Someone'
        }
    }
}

export async function claimTransferAction(token: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Should redirect to login? Action usually returns error
        return { success: false, message: 'Unauthorized', redirect: true }
    }

    // Generate new QR Hash
    const newQrHash = randomBytes(32).toString('hex')

    // Call RPC
    const { data, error } = await supabase.rpc('claim_transfer', {
        p_token: token,
        p_claimer_id: user.id,
        p_new_qr_hash: newQrHash
    })

    if (error) {
        console.error('Claim RPC Execution Error:', {
            error,
            token: token.slice(0, 5) + '...',
            userId: user.id
        })
        return { success: false, message: 'Failed to claim ticket' }
    }

    // data is the JSONB returned from RPC
    if (!data || !data.success) {
        console.error('Claim RPC Business Logic Error:', data)
        return { success: false, message: data?.error || 'Claim failed' }
    }

    return { success: true, ticketId: data.ticketId }
}
