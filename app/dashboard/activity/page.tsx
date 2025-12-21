import { createClient } from '@/utils/supabase/server'
import { ActivityFeed } from '@/components/admin/ActivityFeed'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { History } from 'lucide-react'

export default async function ActivityPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 1. Determine Organization Context
    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let org = null

    // A. Explicit Switch
    if (activeOrgId) {
        // Try finding as owner first
        const { data: explicitOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id, user_id')
            .eq('id', activeOrgId)
            // .eq('user_id', user.id) // Don't filter by user yet, we want to know if it exists even if not owner
            .maybeSingle()

        if (explicitOrg) {
            org = explicitOrg
        } else {
            // Try finding via team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, organizers(id, user_id)')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (teamMember && teamMember.organizers) {
                org = teamMember.organizers as any
            }
        }
    }

    // B. Fallback (Default)
    if (!org) {
        // Latest Owned
        const { data: latestOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id, user_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latestOrg) {
            org = latestOrg
        } else {
            // Latest Team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id, organizers(id, user_id)')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle()

            if (teamMember && teamMember.organizers) {
                org = teamMember.organizers as any
            }
        }
    }

    // 2. Access Control
    if (!org) {
        return redirect('/onboarding')
    }

    const isOwner = org.user_id === user.id

    if (!isOwner) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center mb-6">
                    <History className="w-8 h-8 text-gray-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Restricted</h1>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">The Activity Log is only available to the organization owner.</p>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Activity Log</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Audit trail of all actions performed within your organization.</p>
            </div>

            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm p-8">
                <ActivityFeed organizationId={org.id} />
            </div>
        </div>
    )
}
