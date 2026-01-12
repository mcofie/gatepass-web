'use client'

import React, { useState } from 'react'
import { ProfileSettings } from '@/components/admin/settings/ProfileSettings'
import { OrganizationSettings } from '@/components/admin/settings/OrganizationSettings'
import { TeamSettings } from '@/components/admin/settings/TeamSettings'
import { SettlementSettings } from '@/components/admin/settings/SettlementSettings'
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings'
import { Settings, Users, Shield, Wallet, User, Bell } from 'lucide-react'

export function SettingsClient({
    initialSettings,
    initialOrganizer,
    initialProfile,
    userRole,
    teamInfo
}: {
    initialSettings: Record<string, any>,
    initialOrganizer: any,
    initialProfile: any,
    userRole: string,
    teamInfo: any
}) {
    const [activeTab, setActiveTab] = useState<'details' | 'profile' | 'team' | 'settlement' | 'notifications'>('profile')

    const canManageTeam = (userRole || '').trim().toLowerCase() === 'owner' || (userRole || '').trim().toLowerCase() === 'admin'

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-2">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage your organization profile and team access.</p>
            </div>

            <div className="grid md:grid-cols-[240px_1fr] gap-8">
                {/* Sidebar Navigation */}
                <div className="space-y-1">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'profile'
                            ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                            }`}
                    >
                        <User className="w-4 h-4" />
                        My Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'details'
                            ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                        Organization
                    </button>
                    {canManageTeam && (
                        <>
                            <button
                                onClick={() => setActiveTab('team')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'team'
                                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                Team
                            </button>
                            <button
                                onClick={() => setActiveTab('settlement')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'settlement'
                                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                <Wallet className="w-4 h-4" />
                                Settlement
                            </button>
                            <button
                                onClick={() => setActiveTab('notifications')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'notifications'
                                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                <Bell className="w-4 h-4" />
                                Notifications
                            </button>
                        </>
                    )}
                </div>

                {/* Content Area */}
                <div className="animate-fade-in">
                    {activeTab === 'profile' && (
                        <ProfileSettings profile={initialProfile} userRole={userRole} teamInfo={teamInfo} />
                    )}
                    {activeTab === 'details' && (
                        <OrganizationSettings organizer={initialOrganizer} userRole={userRole} />
                    )}
                    {canManageTeam && (
                        <>
                            {activeTab === 'team' && (
                                <TeamSettings organizer={initialOrganizer} />
                            )}
                            {activeTab === 'settlement' && (
                                <SettlementSettings organizer={initialOrganizer} />
                            )}
                            {activeTab === 'notifications' && (
                                <NotificationSettings organizer={initialOrganizer} userRole={userRole} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

