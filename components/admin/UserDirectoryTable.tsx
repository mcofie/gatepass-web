'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Organizer } from '@/types/gatepass'
import { Search, Shield, User as UserIcon, Building2 } from 'lucide-react'

interface ExtendedProfile extends Profile {
    organizers?: Organizer | Organizer[]
    team_memberships?: any[]
}

interface UserDirectoryTableProps {
    users: ExtendedProfile[]
}

export function UserDirectoryTable({ users: initialUsers }: UserDirectoryTableProps) {
    const [search, setSearch] = useState('')
    const router = useRouter()

    // Normalize organizers to always be an array or null
    const getUsers = () => {
        return initialUsers.filter(u => {
            const match = search.toLowerCase()
            const emailMatch = u.email?.toLowerCase().includes(match)
            const nameMatch = u.full_name?.toLowerCase().includes(match)

            let orgMatch = false
            if (u.organizers) {
                if (Array.isArray(u.organizers)) {
                    orgMatch = u.organizers.some(o => o.name?.toLowerCase().includes(match))
                } else {
                    orgMatch = u.organizers.name?.toLowerCase().includes(match) || false
                }
            }

            let teamMatch = false
            if (u.team_memberships) {
                teamMatch = u.team_memberships.some(tm =>
                    tm.role?.toLowerCase().includes(match) ||
                    tm.organizers?.name?.toLowerCase().includes(match)
                )
            }

            return emailMatch || nameMatch || orgMatch || teamMatch
        })
    }

    const filteredUsers = getUsers()

    return (
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-gray-300 dark:focus:border-white/20 transition-colors placeholder:text-gray-400"
                    />
                </div>
                <div className="text-xs text-gray-500 font-mono">
                    {filteredUsers.length} Users
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-200 uppercase tracking-wider text-xs font-bold border-b border-gray-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Organization</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                        {filteredUsers.map((user) => {
                            const org = Array.isArray(user.organizers) ? user.organizers[0] : user.organizers

                            return (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-white shadow-inner">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                                                ) : (
                                                    (user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white leading-tight">{user.full_name || 'No Name'}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {user.is_super_admin && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                                    <Shield className="w-3 h-3" /> Admin
                                                </span>
                                            )}
                                            {org ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                    <Building2 className="w-3 h-3" /> Organizer
                                                </span>
                                            ) : user.team_memberships?.[0] ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                    <Shield className="w-3 h-3" /> {user.team_memberships[0].role === 'Admin' ? 'Team Admin' : 'Staff'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
                                                    <UserIcon className="w-3 h-3" /> User
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {org ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-bold">
                                                    {org.name[0].toUpperCase()}
                                                </div>
                                                <span className="text-gray-900 dark:text-white font-medium">{org.name}</span>
                                            </div>
                                        ) : user.team_memberships?.[0]?.organizers ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center text-[10px] font-bold">
                                                    {user.team_memberships[0].organizers.name[0].toUpperCase()}
                                                </div>
                                                <span className="text-gray-900 dark:text-white font-medium">{user.team_memberships[0].organizers.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 dark:text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => router.push(`/admin/users/${user.id}`)}
                                            className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                                        >
                                            Details
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                    No users found matching "{search}".
                </div>
            )}
        </div>
    )
}
