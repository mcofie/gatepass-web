'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendVirtualLinkEmail } from '@/utils/email'
import { getDefaultIntegration } from '@/lib/integrations/store'
import { sendSms, sendSmsForOrganizer } from '@/lib/integrations/sms'

interface SMSResponse {
    success: boolean
    message: string
    sentCount?: number
    error?: string
}

/** Owners and any team member of the organization may send its messages. */
async function canMessageFor(organizationId: string): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const admin = createAdminClient()
    const { data: org } = await admin.schema('gatepass').from('organizers').select('user_id').eq('id', organizationId).single()
    if (org?.user_id === user.id) return true

    const { data: member } = await admin
        .schema('gatepass')
        .from('organization_team')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle()
    return !!member
}

/**
 * Sends a single SMS using an organization's configured provider.
 * Useful for one-off notifications from the dashboard.
 */
export async function sendManualSMS(params: {
    to: string,
    message: string,
    organizationId: string
}): Promise<{ success: boolean; error?: string }> {
    if (!(await canMessageFor(params.organizationId))) {
        return { success: false, error: 'Unauthorized' }
    }

    const result = await sendSmsForOrganizer(params.organizationId, params.to, params.message)
    if (!result.success) console.error('Manual SMS failed:', result.error)
    return result
}

export async function sendSMSBlast(
    eventId: string,
    message: string,
    organizationId: string
): Promise<SMSResponse> {
    if (!(await canMessageFor(organizationId))) {
        return { success: false, message: 'Unauthorized' }
    }

    const integration = await getDefaultIntegration(organizationId, 'sms')
    if (!integration) {
        return { success: false, message: 'SMS provider not configured. Please visit Settings > Messaging.' }
    }

    const supabase = await createClient()

    // Fetch Attendees (Guests)
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

    let lastError = ''
    let sentCount = 0

    for (const phone of phoneNumbers) {
        const result = await sendSms(integration, phone, message)
        if (result.success) {
            sentCount++
        } else {
            console.error(`Failed to send SMS to ${phone}:`, result.error)
            lastError = result.error || lastError
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
                    organizerId: event.organization_id,
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
                const smsResult = await sendSmsForOrganizer(event.organization_id, targetPhone, smsMsg)
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
