'use client'

import React, { useState } from 'react'
import { ProfileSettings } from '@/components/admin/settings/ProfileSettings'
import { OrganizationSettings } from '@/components/admin/settings/OrganizationSettings'
import { TeamSettings } from '@/components/admin/settings/TeamSettings'
import { SettlementSettings } from '@/components/admin/settings/SettlementSettings'
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings'
import { MarketingSettings } from '@/components/admin/settings/MarketingSettings'
import { SMSSettings } from '@/components/admin/settings/SMSSettings'
import { Settings, Users, Wallet, User, Bell, Share2, MessageSquare } from 'lucide-react'

type SettingsTab = 'profile' | 'details' | 'team' | 'settlement' | 'notifications' | 'marketing' | 'sms'

export function SettingsClient({
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
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
    const canManageTeam = ['owner', 'admin'].includes((userRole || '').trim().toLowerCase())
    const tabs = [
        { id: 'profile', label: 'My profile', icon: User },
        { id: 'details', label: 'Organization', icon: Settings },
        ...(canManageTeam ? [
            { id: 'team', label: 'Team', icon: Users },
            { id: 'settlement', label: 'Settlement', icon: Wallet },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'marketing', label: 'Marketing', icon: Share2 },
            { id: 'sms', label: 'SMS provider', icon: MessageSquare },
        ] : []),
    ] as { id: SettingsTab, label: string, icon: React.ElementType }[]

    return (
        <div className="mx-auto max-w-[1180px] space-y-8 pb-16">
            <header>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                <h1 className="text-[32px] font-semibold tracking-tight text-gray-950 dark:text-white sm:text-[38px]">Settings</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage your profile, organization, and team access.</p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
                <nav role="tablist" aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-3 dark:border-white/10 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            id={`settings-tab-${id}`}
                            role="tab"
                            onClick={() => setActiveTab(id)}
                            aria-selected={activeTab === id}
                            aria-controls="settings-panel"
                            className={`flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${activeTab === id
                                ? 'bg-gray-100 text-gray-950 dark:bg-white/10 dark:text-white'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                        >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {label}
                        </button>
                    ))}
                </nav>

                <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className="min-w-0">
                    {activeTab === 'profile' && <ProfileSettings profile={initialProfile} userRole={userRole} teamInfo={teamInfo} />}
                    {activeTab === 'details' && <OrganizationSettings organizer={initialOrganizer} userRole={userRole} />}
                    {canManageTeam && activeTab === 'team' && <TeamSettings organizer={initialOrganizer} />}
                    {canManageTeam && activeTab === 'settlement' && <SettlementSettings organizer={initialOrganizer} />}
                    {canManageTeam && activeTab === 'notifications' && <NotificationSettings organizer={initialOrganizer} userRole={userRole} />}
                    {canManageTeam && activeTab === 'marketing' && <MarketingSettings organizer={initialOrganizer} userRole={userRole} />}
                    {canManageTeam && activeTab === 'sms' && <SMSSettings organizer={initialOrganizer} userRole={userRole} />}
                </div>
            </div>
        </div>
    )
}
