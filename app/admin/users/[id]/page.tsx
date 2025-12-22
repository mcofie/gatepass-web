import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import { UserDetailClient } from '@/components/admin/UserDetailClient'

export const revalidate = 0

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = createAdminClient()
    const { id } = await params

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

    if (!profile) {
        return notFound()
    }

    const { data: organizers } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('*')
        .eq('user_id', id)

    const organizer = organizers?.[0] || null

    const { data: teamMemberships } = await supabase
        .schema('gatepass')
        .from('organization_team')
        .select(`
            id,
            role,
            organization_id,
            organizers:organization_id (id, name)
        `)
        .eq('user_id', id)
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id)

    const { data: reservations } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select(`
            *,
            events ( title, starts_at ),
            ticket_tiers ( name, price, currency )
        `)
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

    return (
        <UserDetailClient
            profile={profile}
            organizers={organizers || []}
            teamMemberships={teamMemberships as any || []}
            authUser={user as any}
            reservations={reservations as any || []}
        />
    )
}
