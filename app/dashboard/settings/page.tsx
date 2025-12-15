import { createClient } from '@/utils/supabase/server'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const revalidate = 0

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: settings } = await supabase
        .schema('gatepass')
        .from('platform_settings')
        .select('*')
        .single()

    const { data: organizer } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('*')
        .eq('user_id', user?.id)
        .single()

    return (
        <SettingsClient initialSettings={settings} initialOrganizer={organizer} />
    )
}
