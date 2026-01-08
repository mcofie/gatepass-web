'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Helper to verify super admin status (database-only)
async function verifySuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized: Not authenticated')
    }

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) {
        throw new Error('Forbidden: Super Admin access required')
    }

    return user
}

export async function suspendUser(userId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100 years
    })

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}

export async function unsuspendUser(userId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '0'
    })

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}

export async function toggleSuperAdmin(userId: string, isSuperAdmin: boolean) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()

    // Update profile
    const { error } = await supabase
        .schema('gatepass')
        .from('profiles')
        .update({ is_super_admin: isSuperAdmin })
        .eq('id', userId)

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}


async function deleteEvents(supabase: any, eventIds: string[]) {
    if (eventIds.length === 0) return

    const dependencyTables = [
        'tickets',
        'reservations',
        'event_staff',
        'event_addons',
        'discounts',
        'ticket_tiers'
    ]

    // Delete dependencies
    await supabase.schema('gatepass').from('tickets').delete().in('event_id', eventIds)
    await supabase.schema('gatepass').from('reservations').delete().in('event_id', eventIds)
    await supabase.schema('gatepass').from('event_staff').delete().in('event_id', eventIds)
    await supabase.schema('gatepass').from('event_addons').delete().in('event_id', eventIds)
    await supabase.schema('gatepass').from('discounts').delete().in('event_id', eventIds)
    await supabase.schema('gatepass').from('ticket_tiers').delete().in('event_id', eventIds)

    // Delete events
    const { error } = await supabase
        .schema('gatepass')
        .from('events')
        .delete()
        .in('id', eventIds)

    if (error) throw new Error(error.message)
}

export async function deleteOrganization(organizationId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()

    // 1. Get all events for this organization
    const { data: events } = await supabase
        .schema('gatepass')
        .from('events')
        .select('id')
        .eq('organization_id', organizationId)

    const eventIds = events?.map(e => e.id) || []

    // 2. Cleanup all event dependencies
    try {
        await deleteEvents(supabase, eventIds)
    } catch (e: any) {
        return { error: `Failed to delete events: ${e.message}` }
    }

    // 3. Delete Team Memberships
    await supabase
        .schema('gatepass')
        .from('organization_team')
        .delete()
        .eq('organization_id', organizationId)

    // 4. Delete Organization
    if (error) return { error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
}

export async function deleteUser(userId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()

    // 1. Nullify checked_in_by in Tickets (to preserve scan history but remove link)
    await supabase.schema('gatepass').from('tickets').update({ checked_in_by: null }).eq('checked_in_by', userId)

    // 2. Delete owned organizations
    const { data: orgs } = await supabase.schema('gatepass').from('organizers').select('id').eq('user_id', userId)
    if (orgs && orgs.length > 0) {
        for (const org of orgs) {
            const res = await deleteOrganization(org.id)
            if (res.error) return { error: `Failed to delete organization ${org.id}: ${res.error}` }
        }
    }

    // 3. Delete Personal Events (where organizer_id is user, but not covered by orgs)
    const { data: personalEvents } = await supabase.schema('gatepass').from('events').select('id').eq('organizer_id', userId)
    const personalEventIds = personalEvents?.map(e => e.id) || []
    if (personalEventIds.length > 0) {
        try {
            await deleteEvents(supabase, personalEventIds)
        } catch (e: any) {
            return { error: `Failed to delete personal events: ${e.message}` }
        }
    }

    // 4. Delete User Reservations & Tickets
    const { data: reservations } = await supabase.schema('gatepass').from('reservations').select('id').eq('user_id', userId)
    const reservationIds = reservations?.map(r => r.id) || []

    if (reservationIds.length > 0) {
        await supabase.schema('gatepass').from('tickets').delete().in('reservation_id', reservationIds)
        await supabase.schema('gatepass').from('reservations').delete().in('id', reservationIds)
    }

    // 5. Delete Team Memberships
    await supabase.schema('gatepass').from('organization_team').delete().eq('user_id', userId)

    // 6. Delete Profile (Explicitly)
    const { error: profileError } = await supabase.schema('gatepass').from('profiles').delete().eq('id', userId)
    if (profileError) return { error: `Failed to delete profile: ${profileError.message}` }

    // 7. Delete Auth User
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    // Ignore "User not found" error as we want them gone anyway
    if (authError && !authError.message.includes('User not found')) {
        return { error: authError.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
}
