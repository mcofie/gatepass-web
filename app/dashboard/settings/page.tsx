import { createClient } from '@/utils/supabase/server'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const revalidate = 0

export default async function SettingsPage() {
    const supabase = await createClient()

    const { data: settings } = await supabase
        .schema('gatepass')
        .from('platform_settings')
        .select('*')
        .single()

    return (
        <SettingsClient initialSettings={settings} />
    )
}
