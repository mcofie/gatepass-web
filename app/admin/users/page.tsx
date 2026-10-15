import { createAdminClient } from '@/utils/supabase/admin'
import { listAuthUsers } from '@/lib/admin/auth-users'
import { AdminHeader, AdminStats } from '@/components/admin/AdminUI'
import { UserDirectoryTable, type DirectoryUser } from '@/components/admin/UserDirectoryTable'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export const dynamic = 'force-dynamic'

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ organizer?: string }> }) {
    const { organizer } = await searchParams
    const db = createAdminClient().schema('gatepass')
    const [{ data: profiles }, { data: organizers }, { data: team }, authUsers] = await Promise.all([
        db.from('profiles').select('id, full_name, email, avatar_url, is_super_admin').order('email', { ascending: true }),
        db.from('organizers').select('id, name, user_id'),
        db.from('organization_team').select('user_id, role, organizers:organization_id (id, name)'),
        listAuthUsers(),
    ])

    const now = new Date().getTime()
    const users: DirectoryUser[] = (profiles ?? []).map((p: any) => {
        const auth = authUsers.get(p.id)
        return {
            id: p.id,
            name: p.full_name,
            email: p.email ?? auth?.email ?? null,
            avatarUrl: p.avatar_url,
            admin: !!p.is_super_admin,
            suspended: !!(auth as any)?.banned_until && new Date((auth as any).banned_until).getTime() > now,
            joinedAt: auth?.created_at ?? null,
            lastSeenAt: auth?.last_sign_in_at ?? null,
            orgs: [
                ...(organizers ?? []).filter((o: any) => o.user_id === p.id).map((o: any) => ({ id: o.id, name: o.name, role: 'Owner' })),
                ...(team ?? []).filter((t: any) => t.user_id === p.id && t.organizers).map((t: any) => ({ id: t.organizers.id, name: t.organizers.name, role: t.role ? t.role.charAt(0).toUpperCase() + t.role.slice(1) : 'Team' })),
            ],
        }
    })

    const monthAgo = now - 30 * 86400_000
    const stats = [
        { label: 'Users', value: users.length.toLocaleString(), detail: `${users.filter(u => u.joinedAt && new Date(u.joinedAt).getTime() > monthAgo).length.toLocaleString()} joined in the last 30 days` },
        { label: 'Organization owners', value: users.filter(u => u.orgs.some(o => o.role === 'Owner')).length.toLocaleString(), detail: `${(organizers ?? []).length.toLocaleString()} organizations` },
        { label: 'Team members', value: users.filter(u => u.orgs.some(o => o.role !== 'Owner')).length.toLocaleString(), detail: 'Invited to an organization' },
        { label: 'Platform admins', value: users.filter(u => u.admin).length.toLocaleString(), detail: `${users.filter(u => u.suspended).length.toLocaleString()} suspended accounts` },
    ]

    return (
        <div className="space-y-8 pb-8">
            <AdminHeader title="Users" description="Everyone with a GatePass account: ticket buyers, organizers and their teams." />
            <AdminStats stats={stats} columns={4} />
            <UserDirectoryTable users={users} initialOrganizer={organizer} />
        </div>
    )
}
