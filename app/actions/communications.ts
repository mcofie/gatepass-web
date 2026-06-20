'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendVirtualLinkEmail } from '@/utils/email'

interface SMSResponse {
    success: boolean
    message: string
    sentCount?: number
    error?: string
}

/**
 * Sends a single SMS using an organization's configured provider.
 * Useful for automated reminders and one-off notifications.
 */
export async function sendManualSMS(params: {
    to: string,
    message: string,
    organizationId: string
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    // 1. Fetch Organizer Credentials
    const { data: org } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('sms_provider, hubtel_client_id, hubtel_client_secret, zend_api_key, sms_sender_id')
        .eq('id', params.organizationId)
        .single()

    if (!org || org.sms_provider === 'none' || !org.sms_provider) {
        return { success: false, error: 'SMS Provider not configured for this organization.' }
    }

    try {
        let success = false
        const provider = org.sms_provider?.toLowerCase()
        if (provider === 'hubtel') {
            success = await sendViaHubtel(
                org.hubtel_client_id!,
                org.hubtel_client_secret!,
                org.sms_sender_id || 'GATEPASS',
                params.to,
                params.message
            )
        } else if (provider === 'zend') {
            const zendResult = await sendViaZend(
                org.zend_api_key!,
                org.sms_sender_id || 'GATEPASS',
                params.to,
                params.message
            )
            success = zendResult.success
            if (!success) console.error('Zend error:', zendResult.error)
        }
        return { success }
    } catch (err: any) {
        console.error('Manual SMS failed:', err.message)
        return { success: false, error: err.message }
    }
}

export async function sendSMSBlast(
    eventId: string,
    message: string,
    organizationId: string
): Promise<SMSResponse> {
    const supabase = await createClient()

    // 1. Fetch Organizer Credentials
    const { data: org, error: orgError } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('sms_provider, hubtel_client_id, hubtel_client_secret, zend_api_key, sms_sender_id')
        .eq('id', organizationId)
        .single()

    if (orgError || !org) {
        return { success: false, message: 'Organizer settings not found', error: orgError?.message }
    }

    if (org.sms_provider === 'none' || !org.sms_provider) {
        return { success: false, message: 'SMS Provider not configured. Please visit Settings > SMS Provider.' }
    }

    // 2. Fetch Attendees (Guests)
    const { data: guests, error: guestError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('guest_phone')
        .eq('event_id', eventId)
        .eq('status', 'confirmed')
        .not('guest_phone', 'is', null)

    if (guestError) {
        return { success: false, message: 'Failed to fetch attendees', error: guestError.message }
    }

    if (!guests || guests.length === 0) {
        return { success: false, message: 'No attendees with phone numbers found for this event.' }
    }

    const phoneNumbers = Array.from(new Set(guests.map(g => g.guest_phone).filter(Boolean))) as string[]

    const provider = org.sms_provider?.toLowerCase()
    let lastError = ''
    let sentCount = 0

    for (const phone of phoneNumbers) {
        try {
            let success = false
            if (provider === 'hubtel') {
                success = await sendViaHubtel(
                    org.hubtel_client_id!,
                    org.hubtel_client_secret!,
                    org.sms_sender_id || 'GATEPASS',
                    phone,
                    message
                )
            } else if (provider === 'zend') {
                const zendResult = await sendViaZend(
                    org.zend_api_key!,
                    org.sms_sender_id || 'GATEPASS',
                    phone,
                    message
                )
                success = zendResult.success
                if (!success) lastError = zendResult.error || 'Unknown Zend Error'
            }

            if (success) {
                sentCount++
            } else {
                console.error(`SMS Provider failed to send to ${phone}`)
            }
        } catch (err: any) {
            console.error(`Failed to send SMS to ${phone}:`, err.message)
            lastError = err.message
        }
    }

    revalidatePath('/dashboard/marketing')

    return {
        success: sentCount > 0,
        message: sentCount > 0 ? `Successfully sent ${sentCount} of ${phoneNumbers.length} messages.` : `Failed to send blast: ${lastError || 'No messages were delivered.'}`,
        sentCount,
        error: lastError
    }
}

// ============== PROVIDER IMPLEMENTATIONS ==============

async function sendViaHubtel(clientId: string, clientSecret: string, from: string, to: string, content: string): Promise<boolean> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    let recipient = to.trim().replace(/\D/g, '')
    if (recipient.startsWith('0') && recipient.length === 10) recipient = '233' + recipient.substring(1)
    if (recipient.startsWith('+')) recipient = recipient.substring(1)

    try {
        const response = await fetch('https://api-v2.hubtel.com/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                From: from.substring(0, 11),
                To: recipient,
                Content: content,
                Direction: 'outbound'
            })
        })

        const data = await response.json()
        return response.ok && (data.status === 'Success' || data.responseCode === '00' || data.status === 'Scheduled')
    } catch (e) {
        return false
    }
}

async function sendViaZend(apiKey: string, senderId: string, to: string, message: string): Promise<{ success: boolean; error?: string }> {
    let recipient = to.trim().replace(/\D/g, '')
    // Normalize to +233...
    if (recipient.startsWith('0') && recipient.length === 10) recipient = '+233' + recipient.substring(1)
    if (recipient.startsWith('233')) recipient = '+' + recipient
    if (!recipient.startsWith('+')) recipient = '+' + recipient

    // Normalize API Key (remove 'Bearer ' if already present to avoid duplication)
    const cleanKey = apiKey.trim().startsWith('Bearer ') ? apiKey.trim().split(' ')[1] : apiKey.trim()

    try {
        const response = await fetch('https://api.tryzend.com/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'x-api-key': cleanKey, // Some versions use this header
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: recipient,
                body: message,
                sender_id: senderId.substring(0, 11), // TryZend specific field
                preferred_channels: ['sms']
            })
        })

        const data = await response.json()
        const success = response.ok && (
            data.status === 'success' || 
            data.success === true || 
            String(data.status).toLowerCase().includes('queued') ||
            String(data.message).toLowerCase().includes('queued')
        )
        return { 
            success, 
            error: success ? undefined : (data.message || data.error || JSON.stringify(data))
        }
    } catch (e: any) {
        console.error('Zend API exception:', e)
        return { success: false, error: e.message }
    }
}

export async function notifyAttendeesOfVirtualLink(params: {
    tierId: string
    eventId: string
    virtualLink: string
    virtualInstructions?: string | null
}): Promise<{ success: boolean; sentEmailCount: number; sentSMSCount: number; error?: string }> {
    const supabase = await createClient()

    // 1. Verify caller is authorized (Admin of event or creator)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, sentEmailCount: 0, sentSMSCount: 0, error: 'Unauthorized' }
    }

    // Get event and organization details
    const { data: event, error: eventError } = await supabase
        .schema('gatepass')
        .from('events')
        .select('title, poster_url, organization_id, organizer_id')
        .eq('id', params.eventId)
        .single()

    if (eventError || !event) {
        return { success: false, sentEmailCount: 0, sentSMSCount: 0, error: eventError?.message || 'Event not found' }
    }

    // Verify creator or staff check
    const isOwner = event.organizer_id === user.id
    if (!isOwner) {
        // Check if super admin
        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) {
            // Check if organization staff
            const { data: staff } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('id')
                .eq('organization_id', event.organization_id)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!staff) {
                return { success: false, sentEmailCount: 0, sentSMSCount: 0, error: 'Forbidden: You do not manage this event' }
            }
        }
    }

    // 2. Fetch all confirmed reservations for this tier
    const { data: reservations, error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select(`
            id,
            guest_name,
            guest_email,
            guest_phone,
            profiles:user_id (
                full_name,
                email
            )
        `)
        .eq('tier_id', params.tierId)
        .eq('status', 'confirmed')

    if (resError) {
        return { success: false, sentEmailCount: 0, sentSMSCount: 0, error: resError.message }
    }

    if (!reservations || reservations.length === 0) {
        return { success: true, sentEmailCount: 0, sentSMSCount: 0 }
    }

    let sentEmailCount = 0
    let sentSMSCount = 0

    // Loop through reservations and dispatch email / SMS
    for (const res of reservations) {
        const profile = res.profiles as any
        const customerName = profile?.full_name || res.guest_name || 'Attendee'
        const targetEmail = profile?.email || res.guest_email
        const targetPhone = res.guest_phone

        // Send Email
        if (targetEmail) {
            try {
                await sendVirtualLinkEmail({
                    to: targetEmail,
                    eventName: event.title,
                    customerName,
                    virtualLink: params.virtualLink,
                    virtualInstructions: params.virtualInstructions,
                    posterUrl: event.poster_url
                })
                sentEmailCount++
            } catch (err: any) {
                console.error(`Failed to send email to ${targetEmail}:`, err.message)
            }
        }

        // Send SMS (if phone present and organization SMS settings are configured)
        if (targetPhone && event.organization_id) {
            try {
                // Formatting custom SMS message for the livestream link
                let smsMsg = `Your livestream link for ${event.title} is ready! Join here: ${params.virtualLink}`
                if (params.virtualInstructions) {
                    const passSnippet = ` Passcode: ${params.virtualInstructions}`
                    if ((smsMsg.length + passSnippet.length) <= 160) {
                        smsMsg += passSnippet
                    }
                }
                const smsResult = await sendManualSMS({
                    to: targetPhone,
                    message: smsMsg,
                    organizationId: event.organization_id
                })
                if (smsResult.success) {
                    sentSMSCount++
                }
            } catch (err: any) {
                console.error(`Failed to send SMS to ${targetPhone}:`, err.message)
            }
        }
    }

    return {
        success: true,
        sentEmailCount,
        sentSMSCount
    }
}
