import { createClient } from '@/utils/supabase/server'
import { AllSalesClient } from '@/components/sales/AllSalesClient'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function SalesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrgId = activeOrgId

    // 1. Determine Organization Context
    if (activeOrgId) {
        // Verify access to this specific org ID
        const { data: explicitOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id, user_id')
            .eq('id', activeOrgId)
            .maybeSingle()

        if (explicitOrg) {
            if (explicitOrg.user_id !== user.id) {
                // If not owner, check team membership
                const { data: teamMember } = await supabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('organization_id')
                    .eq('organization_id', activeOrgId)
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (!teamMember) resolvedOrgId = undefined
            }
        } else {
            // Org doesn't exist or no access, invalid cookie
            resolvedOrgId = undefined
        }
    }

    // Fallback: Default logic (Latest Owner -> Latest Team)
    if (!resolvedOrgId) {
        // Latest Owned
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
            // Latest Team
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
        return redirect('/dashboard')
    }

    return (
        <div className="max-w-7xl mx-auto py-8">
            <AllSalesClient orgId={resolvedOrgId} />
        </div>
    )
}
