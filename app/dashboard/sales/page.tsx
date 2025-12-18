import { createClient } from '@/utils/supabase/server'
import { AllSalesClient } from '@/components/sales/AllSalesClient'
import { redirect } from 'next/navigation'

export default async function SalesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    // 1. Determine Organization Context
    // Check if owner
    let { data: org } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('id')
        .eq('user_id', user.id)
        .single()

    // If not owner, check if team member
    if (!org) {
        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (teamMember) {
            org = { id: teamMember.organization_id }
        }
    }

    if (!org) {
        return redirect('/dashboard')
    }

    return (
        <div className="max-w-7xl mx-auto py-8">
            <AllSalesClient orgId={org.id} />
        </div>
    )
}
