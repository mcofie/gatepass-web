'use server'

import { createClient } from '@/utils/supabase/server'
import { sendStaffAccessEmail } from '@/utils/email'
import { revalidatePath } from 'next/cache'

import { randomBytes } from 'crypto'

function generateAccessCode(length = 5) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length]
    }
    return result
}

export async function createEventStaff(
    eventId: string,
    name: string,
    email: string
) {
    const supabase = await createClient()

    // 1. Authorize: Check if current user is the organizer of the event
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, error: 'Unauthorized' }
    }

    const { data: event } = await supabase
        .schema('gatepass')
        .from('events')
        .select('title, organizer_id')
        .eq('id', eventId)
        .single()

    if (!event || event.organizer_id !== user.id) {
        return { success: false, error: 'Unauthorized: You do not own this event' }
    }

    // 2. Generate Code & Insert
    // Retry loop for collision (unlikely with 5 chars for one event, but good practice)
    let accessCode = generateAccessCode()
    let createdStaff = null
    let attempts = 0

    while (!createdStaff && attempts < 3) {
        const { data, error } = await supabase
            .schema('gatepass')
            .from('event_staff')
            .insert({
                event_id: eventId,
                name,
                email,
                access_code: accessCode
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') { // Unique violation
                accessCode = generateAccessCode()
                attempts++
                continue
            }
            console.error('Create Staff Error:', error)
            return { success: false, error: error.message }
        }
        createdStaff = data
    }

    if (!createdStaff) {
        return { success: false, error: 'Failed to generate unique code' }
    }

    // 3. Send Email
    try {
        await sendStaffAccessEmail({
            to: email,
            eventName: event.title,
            staffName: name,
            accessCode: accessCode
        })
    } catch (e: any) {
        console.error('Failed to send staff email:', e)
        // Return success but with warning? Or just allow it (client can retry if needed)
        // ideally we might want to surface this, but the record is created.
        return { success: true, staff: createdStaff, warning: `Staff created but email failed: ${e.message}` }
    }

    revalidatePath(`/dashboard/events/${eventId}`)
    return { success: true, staff: createdStaff }
}

export async function fetchEventStaff(eventId: string) {
    const supabase = await createClient()

    // We can rely on RLS policy "Organizers can manage staff for their events"
    // but explicit check is also fine.

    const { data, error } = await supabase
        .schema('gatepass')
        .from('event_staff')
        .select('*, tickets!checked_in_by(count)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Fetch Staff Error:', error)
        return []
    }

    // Transform to flat structure
    return data.map((staff: any) => ({
        ...staff,
        check_in_count: staff.tickets?.[0]?.count || 0
    }))
}

export async function deleteEventStaff(staffId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // 1. Get Event ID
    const { data: staff } = await supabase
        .schema('gatepass')
        .from('event_staff')
        .select('event_id')
        .eq('id', staffId)
        .single()

    if (!staff) return { success: false, error: 'Staff member not found' }

    // 2. Check Ownership
    const { data: event } = await supabase
        .schema('gatepass')
        .from('events')
        .select('organizer_id')
        .eq('id', staff.event_id)
        .single()

    if (!event || event.organizer_id !== user.id) {
        return { success: false, error: 'Unauthorized: You do not own this event' }
    }

    // 3. Delete
    const { error } = await supabase.schema('gatepass').from('event_staff').delete().eq('id', staffId)
    if (error) {
        return { success: false, error: error.message }
    }
    return { success: true }
}
