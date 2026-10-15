'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import { AdminCard, AdminEmpty, AdminPill, Initial } from '@/components/admin/AdminUI'

export type DirectoryUser = {
    id: string
    name: string | null
    email: string | null
    avatarUrl: string | null
    admin: boolean
    suspended: boolean
    joinedAt: string | null
    lastSeenAt: string | null
    orgs: { id: string; name: string; role: string }[]
}

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'owners', label: 'Owners' },
    { id: 'team', label: 'Team members' },
    { id: 'buyers', label: 'Buyers only' },
    { id: 'admins', label: 'Admins' },
    { id: 'suspended', label: 'Suspended' },
] as const
type Filter = (typeof FILTERS)[number]['id']

const PAGE = 50
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export function UserDirectoryTable({ users, initialOrganizer }: { users: DirectoryUser[]; initialOrganizer?: string }) {
    // Arriving from an organizer link (e.g. the overview's "Needs attention") narrows to that organization
    const orgName = initialOrganizer ? users.flatMap(u => u.orgs).find(o => o.id === initialOrganizer)?.name : undefined
    const [query, setQuery] = React.useState(orgName ?? '')
    const [filter, setFilter] = React.useState<Filter>('all')
    const [shown, setShown] = React.useState(PAGE)

    const q = query.trim().toLowerCase()
    const visible = users.filter(u => {
        if (q && !`${u.name ?? ''} ${u.email ?? ''} ${u.orgs.map(o => o.name).join(' ')}`.toLowerCase().includes(q)) return false
        if (filter === 'owners') return u.orgs.some(o => o.role === 'Owner')
        if (filter === 'team') return u.orgs.some(o => o.role !== 'Owner')
        if (filter === 'buyers') return u.orgs.length === 0 && !u.admin
        if (filter === 'admins') return u.admin
        if (filter === 'suspended') return u.suspended
        return true
    })

    return (
        <AdminCard>
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <label className="relative block lg:w-80">
                    <span className="sr-only">Search users</span>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }} placeholder="Search name, email or organization" className="h-10 w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/60" />
                </label>
                <div role="radiogroup" aria-label="Filter users" className="-mx-1 flex gap-1 overflow-x-auto px-1">
                    {FILTERS.map(f => (
                        <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => { setFilter(f.id); setShown(PAGE) }} className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${filter === f.id ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {visible.length === 0 ? <AdminEmpty>{q ? `No users match “${query}”.` : 'No users here.'}</AdminEmpty> : (
                <ul className="divide-y divide-gray-100 dark:divide-white/10">
                    {visible.slice(0, shown).map(u => (
                        <li key={u.id}>
                            <Link href={`/admin/users/${u.id}`} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-6">
                                <Initial name={u.name || u.email} src={u.avatarUrl} />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-gray-950 dark:text-white">{u.name || 'No name'}</span>
                                        {u.admin && <AdminPill tone="ink">Admin</AdminPill>}
                                        {u.suspended && <AdminPill tone="danger">Suspended</AdminPill>}
                                    </span>
                                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{u.email ?? 'No email'}</span>
                                </span>
                                <span className="hidden min-w-0 max-w-[260px] flex-1 md:block">
                                    {u.orgs.length ? (
                                        <span className="block truncate text-[13px] text-gray-700 dark:text-gray-300" title={u.orgs.map(o => `${o.name} (${o.role})`).join(', ')}>
                                            {u.orgs[0].name} <span className="text-gray-400">· {u.orgs[0].role}</span>
                                            {u.orgs.length > 1 && <span className="text-gray-400"> · +{u.orgs.length - 1}</span>}
                                        </span>
                                    ) : <span className="text-[13px] text-gray-400 dark:text-gray-500">Buyer</span>}
                                </span>
                                <span className="hidden w-28 shrink-0 text-right lg:block">
                                    <span className="block text-[13px] tabular-nums text-gray-700 dark:text-gray-300">{shortDate(u.joinedAt)}</span>
                                    <span className="block text-[11px] text-gray-400 dark:text-gray-500">joined</span>
                                </span>
                                <ChevronRight className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-950 dark:text-gray-600 dark:group-hover:text-white" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400 sm:px-6">
                <span>{visible.length.toLocaleString()} {visible.length === 1 ? 'user' : 'users'}</span>
                {visible.length > shown && (
                    <button type="button" onClick={() => setShown(n => n + PAGE)} className="h-8 rounded-full border border-gray-200 px-4 text-[13px] font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                        Show more
                    </button>
                )}
            </div>
        </AdminCard>
    )
}
