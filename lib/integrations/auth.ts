import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

/** Only the organizer's owner and team admins may manage integrations. */
export async function assertCanManage(organizerId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const admin = createAdminClient()
    const { data: org } = await admin.schema('gatepass').from('organizers').select('user_id').eq('id', organizerId).single()
    if (!org) throw new Error('Organization not found')
    if (org.user_id === user.id) return user

    const { data: member } = await admin
        .schema('gatepass')
        .from('organization_team')
        .select('role')
        .eq('organization_id', organizerId)
        .eq('user_id', user.id)
        .maybeSingle()
    if (member?.role === 'admin') return user

    throw new Error('Only owners and admins can manage integrations')
}

