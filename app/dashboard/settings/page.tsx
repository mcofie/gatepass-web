import { createClient } from '@/utils/supabase/server'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const revalidate = 0

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: settingsData } = await supabase
        .schema('gatepass')
        .from('settings')
        .select('key, value')

    const settings = settingsData?.reduce((acc: any, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {}) || {}

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
