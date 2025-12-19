'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Organizer } from '@/types/gatepass'
import { ArrowLeft, Mail, Calendar, Shield, Building2, CreditCard, MoreHorizontal, Ban, Trash2, User } from 'lucide-react'
import { format } from 'date-fns'

interface UserDetailProps {
    profile: Profile
    organizer: Organizer | null
    teamMemberships?: any[]
}

export function UserDetailClient({ profile, organizer, teamMemberships = [] }: UserDetailProps) {
    const router = useRouter()

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {profile.full_name || 'Anonymous User'}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                        <span>{profile.id}</span>
                        {profile.is_super_admin && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                <Shield className="w-3 h-3" /> Admin
                            </span>
                        )}
                        {organizer && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                <Building2 className="w-3 h-3" /> Organizer
                            </span>
                        )}
                        {teamMemberships.map((tm) => (
                            <span key={tm.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                <Shield className="w-3 h-3" /> {tm.role === 'Admin' ? 'Team Admin' : 'Staff'}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <Ban className="w-4 h-4" />
                        Suspend
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-600/20">
                        <Trash2 className="w-4 h-4" />
                        Delete User
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Profile Info */}
                <div className="space-y-6">
                    {/* User Card */}
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-2xl font-bold text-gray-500 dark:text-gray-300 shadow-inner mb-4">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                                ) : (
                                    (profile.full_name?.[0] || profile.email?.[0] || '?').toUpperCase()
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profile.full_name}</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{profile.email}</p>
                        </div>

                        <div className="mt-8 space-y-4">
                            <InfoRow icon={Mail} label="Email" value={profile.email || '-'} />
                            <InfoRow icon={Calendar} label="Joined" value={profile.updated_at ? format(new Date(profile.updated_at), 'MMM d, yyyy') : '-'} />
                            <InfoRow icon={User} label="Username" value={profile.username || '-'} />
                        </div>
                    </div>

                    {/* Organizer Card (Conditional) */}
                    {organizer && (
                        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Building2 className="w-24 h-24 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-500" />
                                Organization
                            </h3>

                            <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">Name</label>
                                    <p className="text-gray-900 dark:text-white font-medium">{organizer.name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">Bank</label>
                                        <p className="text-gray-900 dark:text-white font-medium">{organizer.bank_name || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">Account</label>
                                        <p className="text-gray-900 dark:text-white font-medium font-mono text-sm">{organizer.account_number ? `****${organizer.account_number.slice(-4)}` : '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">Slug</label>
                                    <p className="text-gray-900 dark:text-white font-mono text-sm bg-gray-50 dark:bg-black/20 p-2 rounded-lg border border-gray-100 dark:border-white/5">{organizer.slug}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Team Memberships Card */}
                    {teamMemberships.length > 0 && (
                        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-purple-500" />
                                Team Access
                            </h3>
                            <div className="space-y-4">
                                {teamMemberships.map((tm) => (
                                    <div key={tm.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">{tm.role}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-purple-600/20">
                                                {tm.organizers?.name?.[0]?.toUpperCase() || 'O'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white leading-tight">{tm.organizers?.name}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 uppercase tracking-wide">Org ID: {tm.organization_id.split('-')[0]}...</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Activity / Stats */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard label="Total Orders" value="0" icon={CreditCard} />
                        <StatCard label="Tickets Bought" value="0" icon={Calendar} />
                        <StatCard label="Last Active" value="Just now" icon={User} />
                    </div>

                    {/* Empty State for Activity */}
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-3xl p-12 text-center shadow-sm min-h-[400px] flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                            <CreditCard className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No activity recorded</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                            This user hasn't made any transactions or attended any events yet (mock data for now).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoRow({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 group-hover:bg-white dark:group-hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={value}>{value}</p>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon }: any) {
    return (
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    )
}
