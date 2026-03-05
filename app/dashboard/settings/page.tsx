import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const revalidate = 0

interface TeamMemberRecord {
    organization_id: string
    organization: Record<string, unknown> | null
}

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

    const settings = settingsData?.reduce((acc: Record<string, unknown>, curr) => {
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
                    .select('organization_id, organization:organizers(*)')
                    .eq('organization_id', activeOrgId)
                    .eq('user_id', user?.id)
                    .maybeSingle()

                const tm = teamMember as unknown as TeamMemberRecord
                if (tm && tm.organization) {
                    resolvedOrganizer = tm.organization
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
                resolvedOrganizer = teamMember.organizers as unknown as Record<string, unknown>
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
                .select('role, organization_id, organization:organizers(*)')
                .eq('user_id', user?.id)
                .limit(1)
                .maybeSingle()

            const tm = teamMember as unknown as TeamMemberRecord
            if (tm && tm.organization) {
                resolvedOrgId = tm.organization_id
                resolvedOrganizer = tm.organization
            } else if (user?.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                // Secondary fallback: Try as admin by email (bypasses RLS)
                const { createClient: createAdminClient } = await import('@supabase/supabase-js')
                const adminSupabase = createAdminClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                )

                const { data: inviteByEmail } = await adminSupabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('organization_id, organization:organizers(*)')
                    .ilike('email', user.email)
                    .limit(1)
                    .maybeSingle()

                const inv = inviteByEmail as unknown as TeamMemberRecord
                if (inv && inv.organization) {
                    resolvedOrgId = inv.organization_id
                    resolvedOrganizer = inv.organization

                    // Trigger sync synchronously
                    const { syncUserTeamMemberships } = await import('@/app/actions/team')
                    await syncUserTeamMemberships()
                }
            }
        }
    }

    if (!resolvedOrgId || !resolvedOrganizer) {
        return redirect('/onboarding')
    }

    // Determine Role for this specific resolved organizer
    let role = resolvedOrganizer.user_id === user?.id ? 'Owner' : 'Member'
    const teamInfo = null

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
