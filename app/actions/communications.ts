'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
        if (org.sms_provider === 'hubtel') {
            success = await sendViaHubtel(
                org.hubtel_client_id!,
                org.hubtel_client_secret!,
                org.sms_sender_id || 'GATEPASS',
                params.to,
                params.message
            )
        } else if (org.sms_provider === 'zend') {
            success = await sendViaZend(
                org.zend_api_key!,
                org.sms_sender_id || 'GATEPASS',
                params.to,
                params.message
            )
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

    let sentCount = 0
    let lastError = ''

    for (const phone of phoneNumbers) {
        try {
            let success = false
            if (org.sms_provider === 'hubtel') {
                success = await sendViaHubtel(
                    org.hubtel_client_id!,
                    org.hubtel_client_secret!,
                    org.sms_sender_id || 'GATEPASS',
                    phone,
                    message
                )
            } else if (org.sms_provider === 'zend') {
                success = await sendViaZend(
                    org.zend_api_key!,
                    org.sms_sender_id || 'GATEPASS',
                    phone,
                    message
                )
            }

            if (success) sentCount++
        } catch (err: any) {
            console.error(`Failed to send SMS to ${phone}:`, err.message)
            lastError = err.message
        }
    }

    revalidatePath('/dashboard/marketing')

    return {
        success: sentCount > 0,
        message: `Successfully sent ${sentCount} of ${phoneNumbers.length} messages.`,
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

async function sendViaZend(apiKey: string, senderId: string, to: string, message: string): Promise<boolean> {
    let recipient = to.trim().replace(/\D/g, '')
    if (recipient.startsWith('0') && recipient.length === 10) recipient = '233' + recipient.substring(1)
    
    try {
        const response = await fetch('https://api.tryzend.com/v1/sms/send', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender_id: senderId.substring(0, 11),
                recipient: recipient,
                message: message
            })
        })

        const data = await response.json()
        return response.ok && data.status === 'success'
    } catch (e) {
        return false
    }
}
