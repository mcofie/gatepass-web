import { createClient } from '@/utils/supabase/server'
import { ActivityFeed } from '@/components/admin/ActivityFeed'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'

export default async function ActivityPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // 1. Determine Organization Context & Ownership
    // Check if owner
    let { data: org } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single()

    // Strict Owner Check: If user is not the owner (user_id matches), deny access.
    // The user request said "only visible to org owner". 
    // If org is null here, they might be a team member.

    if (!org) {
        // Check if they are a team member to gracefully handle "No Org" vs "Not Owner"
        // But for strict "Owner Only" requirement:
        // If they don't have an org where they are the owner, they can't see this.
        // We might want to check team members just to be sure we don't block them if the requirement was loose, 
        // but "org owner" usually means the creator.
        // Let's stick to strict owner check for now as requested.

        // However, if they are an ADMIN-level team member, maybe they should see it?
        // User said "org owner". I will restrict to `org.user_id === user.id`.

        const { data: teamMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()

        if (teamMember) {
            // They are a team member, but not owner.
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <History className="w-8 h-8 text-gray-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
                    <p className="text-gray-500 max-w-md">The Activity Log is only available to the organization owner.</p>
                </div>
            )
        }

        return redirect('/onboarding')
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Activity Log</h1>
                <p className="text-gray-500 font-medium">Audit trail of all actions performed within your organization.</p>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <ActivityFeed organizationId={org.id} />
            </div>
        </div>
    )
}
