'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/app/actions/logger'

// Helper to check Super Admin permission
async function checkSuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) throw new Error('Forbidden')
    return supabase
}

export async function updateEventFee(eventId: string, feePercent: number | null) {
    const supabase = await checkSuperAdmin()

    const { data, error } = await supabase
        .schema('gatepass')
        .from('events')
        .update({ platform_fee_percent: feePercent })
        .eq('id', eventId)
        .select('organization_id')
        .single()

    if (error) throw new Error(error.message)

    // Log Activity (Use event's org id)
    // We assume data is returned if we select it
    if (data) {
        await logActivity(data.organization_id || 'system', 'update_event_fee', 'event', eventId, { new_fee: feePercent })
    }

    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin/events')
    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin/events')
}

export async function updateEventFeeBearer(eventId: string, bearer: 'customer' | 'organizer') {
    const supabase = await checkSuperAdmin()

    const { data, error } = await supabase
        .schema('gatepass')
        .from('events')
        .update({ fee_bearer: bearer })
        .eq('id', eventId)
        .select('organization_id')
        .single()

    if (error) throw new Error(error.message)

    if (data) {
        await logActivity(data.organization_id || 'system', 'update_fee_bearer', 'event', eventId, { new_bearer: bearer })
    }

    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath('/admin/events')
}

export async function updateOrganizerFee(organizerId: string, feePercent: number | null) {
    const supabase = await checkSuperAdmin()

    const { error } = await supabase
        .schema('gatepass')
        .from('organizers')
        .update({ platform_fee_percent: feePercent })
        .eq('id', organizerId)

    if (error) throw new Error(error.message)

    // Log Activity (Use organizer_id as org_id, since organizer IS the org usually?)
    // Actually organizers table *defines* the organization? Or is it a profile?
    // In this schema, organizers table seems to be the "Organisation".
    // So organizationId = organizerId.
    await logActivity(organizerId, 'update_organizer_fee', 'organizer', organizerId, { new_fee: feePercent })

    revalidatePath('/admin/users')
    // We ideally should revalidate where the organizer's details are shown.
    // If we have a specific organizer page (e.g. via user), revalidate that too.
}
