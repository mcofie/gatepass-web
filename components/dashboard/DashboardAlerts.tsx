import { createClient } from '@/utils/supabase/server'
import { DashboardAlertsClient } from './DashboardAlertsClient'

export async function DashboardAlerts() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // 1. Determine Organization Context and Settlement Status
    let { data: org } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('*')
        .eq('user_id', user.id)
        .single()

    // If not owner, check if team member
    if (!org) {
        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('organization_id, organizers(*)')
            .eq('user_id', user.id)
            .single()

        if (teamMember) {
            org = teamMember.organizers as any
        }
    }

    // 2. Fetch user profile
    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // 3. Calculate Logic
    const missingOrg = org ? (!org.logo_url || !org.description) : true
    const missingProfile = !profile?.full_name || !profile?.username || !profile?.phone_number
    const needsSetup = (missingOrg || missingProfile) && !!org // Only show setup nudge if they actually have an org shell or checking personal profile

    // Settlement Logic: Only relevant if they are an owner/admin of an org
    // Actually org.paystack_subaccount_code presence determines if they can receive money.
    const needsSettlement = org ? !org.paystack_subaccount_code : false

    if (!needsSetup && !needsSettlement) return null

    return (
        <DashboardAlertsClient
            needsSettlement={needsSettlement}
            needsSetup={needsSetup}
            missingOrg={missingOrg}
            missingProfile={missingProfile}
        />
    )
}
