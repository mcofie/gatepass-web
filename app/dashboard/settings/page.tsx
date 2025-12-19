import { createClient } from '@/utils/supabase/server'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const revalidate = 0

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: settingsData } = await supabase
        .schema('gatepass')
        .from('settings')
        .select('key, value')

    const settings = settingsData?.reduce((acc: any, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {}) || {}

    const { data: organizer } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('*')
        .eq('user_id', user?.id)
        .single()

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

    // Determine user role and team context
    let role = organizer ? 'Owner' : 'Member'
    let teamInfo = null
    let effectiveOrganizer = organizer

    if (!organizer) {
        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('role, organizers(*)')
            .eq('user_id', user?.id)
            .single()

        if (teamMember) {
            role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
            teamInfo = teamMember
            effectiveOrganizer = teamMember.organizers as any
        }
    }

    return (
        <SettingsClient
            initialSettings={settings}
            initialOrganizer={effectiveOrganizer}
            initialProfile={profile}
            userRole={role}
            teamInfo={teamInfo}
        />
    )
}
