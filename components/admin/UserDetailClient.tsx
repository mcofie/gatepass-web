'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { deleteOrganization, deleteUser, suspendUser, toggleSuperAdmin, unsuspendUser } from '@/app/actions/admin'
import { resendTicketEmail } from '@/utils/actions/ticket'
import { AdminCard, AdminEmpty, AdminPill, AdminStats, Initial, moreCurrencies, totalsByCurrency } from '@/components/admin/AdminUI'
import { getProvider } from '@/lib/integrations/providers'
import { formatCurrency } from '@/utils/format'

type Props = {
    profile: { id: string; name: string | null; email: string | null; avatarUrl: string | null; username: string | null; phone: string | null; admin: boolean }
    account: { joinedAt: string | null; lastSeenAt: string | null; suspended: boolean; provider: string | null }
    organizations: { id: string; name: string; slug: string | null; role: string; events: number | null; payments: string[] | null }[]
    orders: { id: string; createdAt: string; status: string; quantity: number; eventId: string | null; event: string; tier: string; amount: number | null; currency: string }[]
}

const date = (iso: string | null, time = false) => iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) })
    : '—'

const pill = 'inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-50'

export function UserDetailClient({ profile, account, organizations, orders }: Props) {
    const router = useRouter()
    const [busy, setBusy] = React.useState<string | null>(null)

    const act = async (key: string, fn: () => Promise<{ error?: string; success?: boolean } | undefined>, done: string, after?: () => void) => {
        setBusy(key)
        try {
            const res = await fn()
            if (res?.error) throw new Error(res.error)
            toast.success(done)
            if (after) after()
            else router.refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Something went wrong')
        } finally {
            setBusy(null)
        }
    }

    const toggleAdmin = () => {
        const next = !profile.admin
        if (!confirm(next ? `Make ${profile.email ?? 'this user'} a platform admin? They'll see every organizer, payment and user.` : `Remove platform admin access from ${profile.email ?? 'this user'}?`)) return
        act('admin', () => toggleSuperAdmin(profile.id, next), next ? 'Now a platform admin' : 'Admin access removed')
    }
    const toggleSuspend = () => {
        if (!account.suspended && !confirm(`Suspend ${profile.email ?? 'this user'}? They're signed out and can't sign in until you lift it.`)) return
        act('suspend', () => (account.suspended ? unsuspendUser(profile.id) : suspendUser(profile.id)), account.suspended ? 'Suspension lifted' : 'User suspended')
    }
    const remove = () => {
        if (prompt(`This permanently deletes ${profile.email ?? 'this user'}, the organizations they own and those organizations' events. Type DELETE to confirm.`) !== 'DELETE') return
        act('delete', () => deleteUser(profile.id), 'User deleted', () => router.push('/admin/users'))
    }
    const removeOrg = (org: Props['organizations'][number]) => {
        if (prompt(`This permanently deletes ${org.name} and its events. Type the organization's name to confirm.`) !== org.name) return
        act(`org-${org.id}`, () => deleteOrganization(org.id), 'Organization deleted')
    }

    const paidOrders = orders.filter(o => o.amount !== null)
    const spent = totalsByCurrency(paidOrders.map(o => ({ amount: o.amount ?? 0, currency: o.currency })))
    const stats = [
        { label: 'Orders', value: orders.length.toLocaleString(), detail: orders.length >= 50 ? 'Latest 50' : `${paidOrders.length.toLocaleString()} paid` },
        { label: 'Tickets', value: orders.reduce((sum, o) => sum + o.quantity, 0).toLocaleString(), detail: 'Across these orders' },
        { label: 'Spent', value: formatCurrency(spent[0]?.amount ?? 0, spent[0]?.currency ?? 'GHS'), detail: spent.length > 1 ? moreCurrencies(spent.length).slice(3) : 'Paid orders' },
        { label: 'Last signed in', value: account.lastSeenAt ? new Date(account.lastSeenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never', detail: account.lastSeenAt ? date(account.lastSeenAt, true) : undefined },
    ]

    return (
        <div className="space-y-8 pb-8">
            <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft className="size-4" aria-hidden="true" /> Users
            </Link>

            <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                    <Initial name={profile.name || profile.email} src={profile.avatarUrl} className="size-16 text-xl" />
                    <div className="min-w-0">
                        <h1 className="truncate text-[30px] font-semibold leading-tight tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[38px]">{profile.name || 'No name'}</h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm text-gray-500 dark:text-gray-400">{profile.email ?? 'No email'}</span>
                            {profile.admin && <AdminPill tone="ink">Platform admin</AdminPill>}
                            {account.suspended && <AdminPill tone="danger">Suspended</AdminPill>}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={toggleAdmin} disabled={!!busy} className={`${pill} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5`}>
                        {busy === 'admin' && <Loader2 className="size-4 animate-spin" />}
                        {profile.admin ? 'Remove admin' : 'Make admin'}
                    </button>
                    <button type="button" onClick={toggleSuspend} disabled={!!busy} className={`${pill} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5`}>
                        {busy === 'suspend' && <Loader2 className="size-4 animate-spin" />}
                        {account.suspended ? 'Lift suspension' : 'Suspend'}
                    </button>
                    <button type="button" onClick={remove} disabled={!!busy} className={`${pill} border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10`}>
                        {busy === 'delete' && <Loader2 className="size-4 animate-spin" />}
                        Delete user
                    </button>
                </div>
            </header>

            <AdminStats stats={stats} columns={4} />

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <AdminCard title="Orders" meta={orders.length ? orders.length.toLocaleString() : undefined}>
                    {orders.length === 0 ? <AdminEmpty>No orders yet.</AdminEmpty> : (
                        <ul className="divide-y divide-gray-100 dark:divide-white/10">
                            {orders.map(o => (
                                <li key={o.id} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                                    <span className="min-w-0 flex-1">
                                        {o.eventId
                                            ? <Link href={`/admin/events/${o.eventId}`} className="block truncate text-sm font-medium text-gray-950 hover:underline dark:text-white">{o.event}</Link>
                                            : <span className="block truncate text-sm font-medium text-gray-950 dark:text-white">{o.event}</span>}
                                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{o.quantity} × {o.tier} · {date(o.createdAt, true)}</span>
                                    </span>
                                    <span className="hidden shrink-0 sm:block">
                                        {o.status === 'confirmed' ? <AdminPill tone="live">Confirmed</AdminPill> : <AdminPill>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</AdminPill>}
                                    </span>
                                    <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{o.amount === null ? 'Free' : formatCurrency(o.amount, o.currency)}</span>
                                    <button
                                        type="button"
                                        onClick={() => act(`resend-${o.id}`, async () => { const r = await resendTicketEmail(o.id); return r.success ? r : { error: r.error ?? 'Could not resend' } }, 'Ticket email sent')}
                                        disabled={!!busy || o.status !== 'confirmed'}
                                        aria-label={`Resend tickets for ${o.event}`}
                                        title="Resend ticket email"
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-950 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white"
                                    >
                                        {busy === `resend-${o.id}` ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </AdminCard>

                <div className="space-y-6">
                    <AdminCard title="Account">
                        <dl className="divide-y divide-gray-100 text-sm dark:divide-white/10">
                            {[
                                ['Email', profile.email ?? '—'],
                                ['Phone', profile.phone ?? '—'],
                                ['Username', profile.username ?? '—'],
                                ['Signs in with', account.provider ? account.provider.charAt(0).toUpperCase() + account.provider.slice(1) : '—'],
                                ['Joined', date(account.joinedAt)],
                                ['User ID', profile.id],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
                                    <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
                                    <dd className={`min-w-0 truncate text-right text-gray-950 dark:text-white ${label === 'User ID' ? 'font-mono text-xs' : ''}`} title={value}>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </AdminCard>

                    <AdminCard title="Organizations" meta={organizations.length || undefined}>
                        {organizations.length === 0 ? <AdminEmpty>Not part of any organization.</AdminEmpty> : (
                            <ul className="divide-y divide-gray-100 dark:divide-white/10">
                                {organizations.map(org => (
                                    <li key={`${org.id}-${org.role}`} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                                        <Initial name={org.name} className="size-9 rounded-xl" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-gray-950 dark:text-white">{org.name}</span>
                                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                                {[
                                                    org.role,
                                                    org.events !== null ? `${org.events} ${org.events === 1 ? 'event' : 'events'}` : null,
                                                    org.payments ? (org.payments.length ? org.payments.map(p => getProvider('payments', p)?.name ?? p).join(', ') : 'No payments set up') : null,
                                                ].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        {org.role === 'Owner' && (
                                            <button type="button" onClick={() => removeOrg(org)} disabled={!!busy} className="h-8 shrink-0 rounded-full px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10">
                                                {busy === `org-${org.id}` ? <Loader2 className="size-4 animate-spin" /> : 'Delete'}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </AdminCard>
                </div>
            </div>
        </div>
    )
}
