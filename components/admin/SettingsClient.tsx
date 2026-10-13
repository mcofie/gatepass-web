'use client'

import React, { useState } from 'react'
import { ProfileSettings } from '@/components/admin/settings/ProfileSettings'
import { OrganizationSettings } from '@/components/admin/settings/OrganizationSettings'
import { TeamSettings } from '@/components/admin/settings/TeamSettings'
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings'
import { IntegrationsPanel } from '@/components/admin/settings/IntegrationsPanel'
import type { IntegrationSummary } from '@/app/actions/integrations'
import { Settings, Users, CreditCard, User, Bell, Share2, MessageSquare } from 'lucide-react'

type SettingsTab = 'profile' | 'details' | 'team' | 'payments' | 'messaging' | 'marketing' | 'notifications'

export function SettingsClient({
    initialOrganizer,
    initialProfile,
    initialIntegrations,
    initialTab,
    userRole,
    teamInfo
}: {
    initialOrganizer: any,
    initialProfile: any,
    initialIntegrations: IntegrationSummary[],
    initialTab?: string,
    userRole: string,
    teamInfo: any
}) {
    const canManageTeam = ['owner', 'admin'].includes((userRole || '').trim().toLowerCase())

    // How many connected providers each connection section has, for the status dot
    const connected = (category: string) => initialIntegrations.filter(i => i.category === category && i.status === 'connected').length

    const groups: { label: string; items: { id: SettingsTab; label: string; icon: React.ElementType; status?: number }[] }[] = [
        { label: 'You', items: [{ id: 'profile', label: 'Profile', icon: User }] },
        {
            label: 'Organization',
            items: [
                { id: 'details', label: 'Details', icon: Settings },
                ...(canManageTeam ? [
                    { id: 'team' as const, label: 'Team', icon: Users },
                    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
                ] : []),
            ],
        },
        ...(canManageTeam ? [{
            label: 'Connections',
            items: [
                { id: 'payments' as const, label: 'Payments', icon: CreditCard, status: connected('payments') },
                { id: 'messaging' as const, label: 'SMS', icon: MessageSquare, status: connected('sms') },
                { id: 'marketing' as const, label: 'Marketing', icon: Share2, status: connected('marketing') },
            ],
        }] : []),
    ]
    const tabs = groups.flatMap(g => g.items)

    // ?tab= deep links (e.g. onboarding → payments), limited to tabs this role can see
    const [activeTab, setActiveTabState] = useState<SettingsTab>(() =>
        tabs.some(t => t.id === initialTab) ? initialTab as SettingsTab : 'profile')
    const setActiveTab = (tab: SettingsTab) => {
        setActiveTabState(tab)
        const url = new URL(window.location.href)
        url.searchParams.set('tab', tab)
        window.history.replaceState(null, '', url)
    }

    const itemClass = (active: boolean) => `flex h-10 shrink-0 items-center gap-3 rounded-full px-4 text-left text-sm font-medium transition-colors lg:rounded-xl lg:px-3 ${active
        ? 'bg-gray-950 text-white dark:bg-white dark:text-black'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`

    return (
        <div className="mx-auto max-w-[1180px] space-y-8 pb-16">
            <header>
                <h1 className="text-[32px] font-semibold tracking-tight text-gray-950 dark:text-white sm:text-[38px]">Settings</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Your profile, your organization, and the accounts GatePass connects to.</p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
                <nav aria-label="Settings sections" className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0">
                    <div role="tablist" aria-orientation="vertical" className="flex min-w-max gap-1 lg:sticky lg:top-24 lg:min-w-0 lg:flex-col lg:gap-6">
                        {groups.map(group => (
                            <div key={group.label} className="flex gap-1 lg:flex-col">
                                <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 lg:block">{group.label}</p>
                                {group.items.map(({ id, label, icon: Icon, status }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        id={`settings-tab-${id}`}
                                        role="tab"
                                        onClick={() => setActiveTab(id)}
                                        aria-selected={activeTab === id}
                                        aria-controls="settings-panel"
                                        className={itemClass(activeTab === id)}
                                    >
                                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                                        <span className="flex-1">{label}</span>
                                        {status !== undefined && (
                                            <span
                                                className={`size-1.5 shrink-0 rounded-full ${status > 0 ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`}
                                                title={status > 0 ? `${status} connected` : 'Not connected'}
                                                aria-label={status > 0 ? `${status} connected` : 'Not connected'}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </nav>

                <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className="min-w-0">
                    {activeTab === 'profile' && <ProfileSettings profile={initialProfile} userRole={userRole} teamInfo={teamInfo} />}
                    {activeTab === 'details' && <OrganizationSettings organizer={initialOrganizer} userRole={userRole} />}
                    {canManageTeam && activeTab === 'team' && <TeamSettings organizer={initialOrganizer} />}
                    {canManageTeam && activeTab === 'payments' && <IntegrationsPanel organizerId={initialOrganizer.id} category="payments" initialIntegrations={initialIntegrations} canEdit={canManageTeam} />}
                    {canManageTeam && activeTab === 'messaging' && <IntegrationsPanel organizerId={initialOrganizer.id} category="sms" initialIntegrations={initialIntegrations} canEdit={canManageTeam} />}
                    {canManageTeam && activeTab === 'marketing' && <IntegrationsPanel organizerId={initialOrganizer.id} category="marketing" initialIntegrations={initialIntegrations} canEdit={canManageTeam} />}
                    {canManageTeam && activeTab === 'notifications' && <NotificationSettings organizer={initialOrganizer} userRole={userRole} />}
                </div>
            </div>
        </div>
    )
}
