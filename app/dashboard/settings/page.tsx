import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const revalidate = 0

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: settingsData } = await supabase
        .schema('gatepass')
        .from('settings')
        .select('key, value')

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

    const settings = settingsData?.reduce((acc: any, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {}) || {}

    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrgId = activeOrgId
    let resolvedOrganizer = null

    // 1. Determine Organization Context
    if (activeOrgId) {
        // Try finding as owner first
        const { data: explicitOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('*')
            .eq('id', activeOrgId)
            .maybeSingle()

        if (explicitOrg) {
            resolvedOrgId = explicitOrg.id
            if (explicitOrg.user_id === user?.id) {
                resolvedOrganizer = explicitOrg
            } else {
                // Check team role for this specific org
                const { data: teamMember } = await supabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('organization_id, organizers(*)')
                    .eq('organization_id', activeOrgId)
                    .eq('user_id', user?.id)
                    .maybeSingle()

                if (teamMember && teamMember.organizers) {
                    resolvedOrganizer = teamMember.organizers as any
                }
            }
        } else {
            // Check if user is part of this org team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, organizers(*)')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user?.id)
                .maybeSingle()

            if (teamMember && teamMember.organizers) {
                resolvedOrgId = teamMember.organization_id
                resolvedOrganizer = teamMember.organizers as any
            } else {
                resolvedOrgId = undefined
            }
        }
    }

    // B. Fallback (Default)
    if (!resolvedOrganizer) {
        const { data: latestOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latestOrg) {
            resolvedOrgId = latestOrg.id
            resolvedOrganizer = latestOrg
        } else {
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('role, organization_id, organizers(*)')
                .eq('user_id', user?.id)
                .limit(1)
                .maybeSingle()

            if (teamMember && teamMember.organizers) {
                resolvedOrgId = teamMember.organization_id
                resolvedOrganizer = teamMember.organizers as any
            }
        }
    }

    if (!resolvedOrgId || !resolvedOrganizer) {
        return redirect('/onboarding')
    }

    // Determine Role for this specific resolved organizer
    let role = resolvedOrganizer.user_id === user?.id ? 'Owner' : 'Member'
    let teamInfo = null

    if (resolvedOrganizer.user_id !== user?.id) {
        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('role')
            .eq('organization_id', resolvedOrgId)
            .eq('user_id', user?.id)
            .maybeSingle()
        if (teamMember) {
            role = teamMember.role.charAt(0).toUpperCase() + teamMember.role.slice(1)
        }
    }

    return (
        <SettingsClient
            initialSettings={settings}
            initialOrganizer={resolvedOrganizer}
            initialProfile={profile}
            userRole={role}
            teamInfo={teamInfo}
        />
    )
}
