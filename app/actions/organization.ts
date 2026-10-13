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
