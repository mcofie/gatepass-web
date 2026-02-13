import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { MarketingDashboard } from '@/components/admin/MarketingDashboard'
import { redirect } from 'next/navigation'
import { BarChart3, ChevronRight } from 'lucide-react'

export const revalidate = 0

export default async function MarketingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    let resolvedOrgId = activeOrgId

    // 1. Verify Active Org ID or Resolve New Context
    if (activeOrgId) {
        // Check if user owns it
        const { data: owned } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('id', activeOrgId)
            .eq('user_id', user.id)
            .maybeSingle()

        if (!owned) {
            // Check if user is on team
            const { data: team } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id')
                .eq('organization_id', activeOrgId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!team) {
                resolvedOrgId = undefined // Cookie is stale/invalid for this user
            }
        }
    }

    // 2. Fallback resolution if no valid context
    if (!resolvedOrgId) {
        const { data: latestOwned } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latestOwned) {
            resolvedOrgId = latestOwned.id
        } else {
            const { data: latestTeam } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organization_id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle()

            if (latestTeam) {
                resolvedOrgId = latestTeam.organization_id
            }
        }
    }

    // 3. Super Admin Fallback
    if (!resolvedOrgId) {
        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .maybeSingle()

        if (profile?.is_super_admin) {
            const { data: anyOrg } = await supabase
                .schema('gatepass')
                .from('organizers')
                .select('id')
                .limit(1)
                .maybeSingle()
            if (anyOrg) resolvedOrgId = anyOrg.id
        }
    }

    // If still no org, show empty state
    if (!resolvedOrgId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                    <BarChart3 className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">No Organization Selected</h2>
                <p className="text-gray-500 mb-8 max-w-sm">Please select or create an organization to view marketing performance statistics.</p>
                <div className="flex gap-4">
                    <a href="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity">
                        Get Started <ChevronRight className="w-4 h-4" />
                    </a>
                    <a href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 dark:border-white/10 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        Go to Dashboard
                    </a>
                </div>
            </div>
        )
    }

    // Fetch Marketing Stats
    const { data: stats } = await supabase
        .schema('gatepass')
        .from('marketing_stats')
        .select(`
            *,
            events!inner (
                id,
                title,
                organization_id
            )
        `)
        .eq('events.organization_id', resolvedOrgId)
        .order('revenue', { ascending: false })

    // Fetch Events for Generator
    const { data: events } = await supabase
        .schema('gatepass')
        .from('events')
        .select('id, title, slug')
        .eq('organization_id', resolvedOrgId)
        .eq('is_published', true)

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col gap-1 px-4 md:px-0">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Marketing Analytics</h1>
                <p className="text-gray-500 font-medium dark:text-gray-400">Track your ad performance and conversion rates across Instagram, Facebook, and more.</p>
            </div>

            <MarketingDashboard initialStats={stats || []} events={events || []} />
        </div>
    )
}
