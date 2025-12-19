import { createClient } from '@/utils/supabase/server'
import { getFeeSettings } from '@/utils/settings'
import { SystemSettingsClient } from '@/components/admin/SystemSettingsClient'
import { redirect } from 'next/navigation'

export const metadata = {
    title: 'System Settings | GatePass Admin',
}

export default async function SystemSettingsPage() {
    const supabase = await createClient()

    // Auth & Role Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-gray-500">You do not have permission to view this page.</p>
            </div>
        )
    }

    // Fetch Settings
    const fees = await getFeeSettings()

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">System Settings</h1>
                <p className="text-gray-500">Manage global platform configuration.</p>
            </div>

            <SystemSettingsClient
                initialPlatformFee={fees.platformFeePercent}
                initialProcessorFee={fees.processorFeePercent}
            />
        </div>
    )
}
