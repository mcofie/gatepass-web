'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export type ActiveOrganization = { id: string; name: string; role: 'Owner' | 'Admin' | 'Staff' }

/**
 * The workspace the user is currently in: the switcher's cookie if they still belong to it,
 * otherwise their newest owned organization, otherwise their first team membership.
 */
export async function getActiveOrganization(): Promise<ActiveOrganization | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const db = supabase.schema('gatepass')
    const roleOf = (role: string) => (role === 'admin' ? 'Admin' : 'Staff') as ActiveOrganization['role']

    const activeId = (await cookies()).get('gatepass-org-id')?.value
    if (activeId) {
        const { data: org } = await db.from('organizers').select('id, name, user_id').eq('id', activeId).maybeSingle()
        if (org?.user_id === user.id) return { id: org.id, name: org.name, role: 'Owner' }
        const { data: member } = await db
            .from('organization_team')
            .select('role, organizers(id, name)')
            .eq('organization_id', activeId)
            .eq('user_id', user.id)
            .maybeSingle()
        const memberOrg = member && (Array.isArray(member.organizers) ? member.organizers[0] : member.organizers) as { id: string; name: string } | null
        if (memberOrg) return { id: memberOrg.id, name: memberOrg.name, role: roleOf(member!.role) }
    }

    const { data: owned } = await db
        .from('organizers')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (owned) return { id: owned.id, name: owned.name, role: 'Owner' }

    const { data: membership } = await db
        .from('organization_team')
        .select('role, organizers(id, name)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
    const teamOrg = membership && (Array.isArray(membership.organizers) ? membership.organizers[0] : membership.organizers) as { id: string; name: string } | null
    return teamOrg ? { id: teamOrg.id, name: teamOrg.name, role: roleOf(membership!.role) } : null
}

export type DeletionCheck = { upcomingTickets: number; heldPayouts: number }

/** What still blocks deleting this organization (owner only; the database enforces it too). */
export async function getOrganizationDeletionCheck(organizationId: string): Promise<DeletionCheck> {
    const supabase = await createClient()
    const { data, error } = await supabase.schema('gatepass').rpc('organization_deletion_blockers', { p_org: organizationId }).single()
    if (error) throw new Error(error.message)
    const row = data as { upcoming_tickets: number; held_payouts: number }
    return { upcomingTickets: Number(row.upcoming_tickets), heldPayouts: Number(row.held_payouts) }
}

/**
 * Deletes the organization as its owner. Events are unpublished and kept (ticket holders keep their
 * tickets and records stay); team, integrations and payout setup are removed.
 */
export async function deleteOrganizationAsOwner(organizationId: string, confirmName: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: org } = await supabase.schema('gatepass').from('organizers').select('name, user_id').eq('id', organizationId).maybeSingle()
    if (!org || org.user_id !== user.id) throw new Error('Only the organization’s owner can delete it.')
    if (confirmName.trim() !== org.name.trim()) throw new Error('Type the organization name exactly to confirm.')

    const { error } = await supabase.schema('gatepass').rpc('delete_organization', { p_org: organizationId })
    if (error) throw new Error(error.message)

    const store = await cookies()
    if (store.get('gatepass-org-id')?.value === organizationId) store.delete('gatepass-org-id')
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard', 'layout')
}
