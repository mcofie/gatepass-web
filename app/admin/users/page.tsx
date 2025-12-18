import { createAdminClient } from '@/utils/supabase/admin'
import { UserDirectoryTable } from '@/components/admin/UserDirectoryTable'

export const revalidate = 0

export default async function UsersPage() {
    const supabase = createAdminClient()

    const { data: profiles } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('*')
        .order('email', { ascending: true })

    const { data: organizers } = await supabase
        .schema('gatepass')
        .from('organizers')
        .select('*')

    const users = profiles?.map(profile => ({
        ...profile,
        organizers: organizers?.filter(org => org.user_id === profile.id) || []
    })) || []

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">User Directory</h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage customers, organizers, and team members.</p>
                </div>
                <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-lg text-sm font-mono text-gray-500 dark:text-gray-400">
                    {users?.length || 0} Total Users
                </div>
            </div>

            <UserDirectoryTable users={users as any || []} />
        </div>
    )
}
