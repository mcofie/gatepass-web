import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { CustomerCRM } from '@/components/admin/CustomerCRM'

export default async function CustomersPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 1. Determine Organization Context
    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrgId = activeOrgId

    // A. Explicit Switch Check
    if (activeOrgId) {
        // Try finding as owner first
        const { data: explicitOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('id', activeOrgId)
            .maybeSingle()

        if (explicitOrg) {
            resolvedOrgId = explicitOrg.id
        } else {
            // Check if user is part of this org team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (teamMember) {
                resolvedOrgId = teamMember.organization_id
            } else {
                resolvedOrgId = undefined
            }
        }
    }

    // B. Fallback (Default)
    if (!resolvedOrgId) {
        const { data: latestOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latestOrg) {
            resolvedOrgId = latestOrg.id
        } else {
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle()

            if (teamMember) {
                resolvedOrgId = teamMember.organization_id
            }
        }
    }

    if (!resolvedOrgId) {
        return redirect('/onboarding')
    }

    return <CustomerCRM organizationId={resolvedOrgId} />
}
