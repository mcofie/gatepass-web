'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { switchOrganization } from '@/app/actions/switch-org'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    Calendar,
    LogOut,
    LayoutDashboard,
    Settings,
    Users,
    ShieldAlert,
    BarChart3,
    ReceiptText,
    UserRound,
    ChevronsUpDown,
    Check,
    Plus,
    Menu,
    X,
    Ticket,
    ArrowUpRight,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Skeleton } from '@/components/ui/skeleton'
import { OrgSwitchOverlay } from '@/components/ui/OrgSwitchOverlay'
import { AnimatePresence } from 'framer-motion'
import { GatePassMark } from '@/components/branding/GatePassMark'

export function AdminSidebar({ activeOrgId }: { activeOrgId?: string }) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const [user, setUser] = useState<User | null>(null)
    const [isOwner, setIsOwner] = useState(false)
    const [role, setRole] = useState<string>('Administrator')
    const [orgDetails, setOrgDetails] = useState<{ name: string } | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)
    const [orgMenuOpen, setOrgMenuOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [accountOpen, setAccountOpen] = useState(false)
    const [allOrgs, setAllOrgs] = useState<{ id: string, name: string, role: string }[]>([])
    const [isSwitching, setIsSwitching] = useState(false)
    const [targetOrgName, setTargetOrgName] = useState<string>('')

    useEffect(() => {
        let mounted = true

        const run = async () => {
            if (!mounted) return
            setLoading(true)

            const { data: authData, error: authErr } = await supabase.auth.getUser()
            if (!mounted) return

            if (authErr) {
                setUser(null)
                setIsOwner(false)
                setOrgDetails(null)
                setIsSuperAdmin(false)
                setLoading(false)
                return
            }

            const authedUser = authData?.user ?? null
            setUser(authedUser)

            if (!authedUser) {
                setIsOwner(false)
                setOrgDetails(null)
                setIsSuperAdmin(false)
                setLoading(false)
                return
            }

            // 1. Fetch ALL owned orgs
            const { data: ownedOrgs } = await supabase
                .schema('gatepass')
                .from('organizers')
                .select('id, name')
                .eq('user_id', authedUser.id)
                .order('created_at', { ascending: false })

            // 2. Fetch ALL team memberships
            interface TeamOrgRecord {
                role: string
                organization: { id: string; name: string } | null
            }
            const { data: teamOrgs, error: teamErr } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('role, organization:organizers(id, name)')
                .eq('user_id', authedUser.id)

            if (teamErr) {
                console.error('Sidebar: Error fetching team orgs:', teamErr.message)
            }

            const combined: { id: string, name: string, role: string }[] = []

            if (ownedOrgs) {
                ownedOrgs.forEach(o => combined.push({ id: o.id, name: o.name, role: 'Owner' }))
            }
            if (teamOrgs) {
                (teamOrgs as unknown as TeamOrgRecord[]).forEach((t) => {
                    if (t.organization) {
                        combined.push({ id: t.organization.id, name: t.organization.name, role: t.role })
                    }
                })
            }
            if (mounted) setAllOrgs(combined)

            let isFoundViaActiveId = false

            // 3. Try Active Org ID (from cookie prop)
            if (activeOrgId) {
                // Check if owned
                const matchedOwned = ownedOrgs?.find(o => o.id === activeOrgId)
                if (matchedOwned) {
                    if (mounted) {
                        setIsOwner(true)
                        setRole('Owner')
                        setOrgDetails({ name: matchedOwned.name })
                        isFoundViaActiveId = true
                    }
                } else {
                    // Check if team
                    const matchedTeam = (teamOrgs as unknown as TeamOrgRecord[])?.find((t) => t.organization?.id === activeOrgId)
                    if (matchedTeam) {
                        if (mounted) {
                            setIsOwner(false)
                            const rawRole = matchedTeam.role || 'Staff'
                            setRole(rawRole.charAt(0).toUpperCase() + rawRole.slice(1))
                            setOrgDetails({ name: matchedTeam.organization?.name ?? 'Unknown Organization' })
                            isFoundViaActiveId = true
                        }
                    }
                }
            }

            // 4. Fallback if no active ID or not found
            if (!isFoundViaActiveId && combined.length > 0) {
                // Pick first one (Latest Owner -> Then Teams)
                const first = combined[0]
                if (mounted) {
                    setIsOwner(first.role === 'Owner')
                    setRole(first.role)
                    setOrgDetails({ name: first.name })
                }
            } else if (combined.length === 0) {
                if (mounted) {
                    setIsOwner(false)
                    setOrgDetails(null)
                }
            }

            // Super Admin?
            const { data: profile } = await supabase
                .schema('gatepass')
                .from('profiles')
                .select('is_super_admin')
                .eq('id', authedUser.id)
                .maybeSingle()

            if (!mounted) return
            setIsSuperAdmin(!!profile?.is_super_admin)

            setLoading(false)
            setIsSwitching(false)
        }

        run()

        return () => {
            mounted = false
        }
    }, [supabase, activeOrgId])

    const handleSwitchOrg = async (orgId: string, orgName: string) => {
        setIsSwitching(true)
        setTargetOrgName(orgName)
        setOrgMenuOpen(false)

        try {
            // Smart Redirect: Stay on current page if it's a general section, otherwise go to dashboard
            const safeCurrentPath = ['/dashboard/settings', '/dashboard/events', '/dashboard/sales', '/dashboard/customers', '/dashboard']
            const redirectTo = safeCurrentPath.includes(pathname) ? pathname : '/dashboard'

            await switchOrganization(orgId, redirectTo)
        } catch (err) {
            // If it's a redirect error, ignore it as Next.js handles it
            // If it's a real error, we should stop the loading
            console.error('Switch failed:', err)
            setIsSwitching(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const isActive = (path: string) => {
        if (path === '/dashboard') return pathname === path
        return pathname.startsWith(path)
    }

    const isAdmin =
        !!user?.email &&
        ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com'].includes(
            user.email.toLowerCase()
        )

    const navItems = useMemo(() => [
        { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Events', path: '/dashboard/events', icon: Calendar },
        { name: 'Sales', path: '/dashboard/sales', icon: ReceiptText },
        { name: 'Customers', path: '/dashboard/customers', icon: Users },
        { name: 'Marketing', path: '/dashboard/marketing', icon: BarChart3 },
    ], [])

    const canCreate = !loading && !!orgDetails && role.toLowerCase() !== 'staff'
    const close = () => { setMobileOpen(false); setAccountOpen(false) }
    const linkClass = (active: boolean) => "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors " + (active
        ? "bg-gray-950 text-white dark:bg-white dark:text-black"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white")

    return (
        <>
            <AnimatePresence>
                {isSwitching && <OrgSwitchOverlay orgName={targetOrgName} />}
            </AnimatePresence>

            <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5 dark:border-white/10 dark:bg-[#0b0b0b] lg:hidden">
                <Link href="/dashboard" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                    <GatePassMark className="size-8" /> GatePass
                </Link>
                <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open dashboard menu" aria-controls="dashboard-sidebar" aria-expanded={mobileOpen} className="flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                    <Menu className="size-5" />
                </button>
            </div>

            {mobileOpen && <button type="button" aria-label="Close dashboard menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />}

            <aside id="dashboard-sidebar" className={"fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] shrink-0 flex-col border-r border-gray-200 bg-white text-gray-950 transition-transform duration-200 dark:border-white/10 dark:bg-[#0b0b0b] dark:text-white lg:sticky lg:top-0 lg:translate-x-0 " + (mobileOpen ? "translate-x-0" : "-translate-x-full")}>
                <div className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.035em]">
                            <GatePassMark className="size-8" /> GatePass
                        </Link>
                        <button type="button" aria-label="Close dashboard menu" onClick={() => setMobileOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden"><X className="size-4" /></button>
                    </div>

                    <div className="relative mt-5">
                        {loading ? (
                            <Skeleton className="h-[58px] w-full rounded-xl bg-gray-100 dark:bg-white/10" />
                        ) : (
                            <button type="button" onClick={() => setOrgMenuOpen(open => !open)} aria-label="Switch organization" aria-expanded={orgMenuOpen} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 dark:border-white/15 dark:hover:bg-white/5">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-sm font-semibold text-white dark:bg-white dark:text-black">{orgDetails?.name?.charAt(0).toUpperCase() || 'G'}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-semibold">{orgDetails?.name || 'Choose organization'}</span>
                                    <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{allOrgs.length > 1 ? `${allOrgs.length} organizations` : role}</span>
                                </span>
                                <ChevronsUpDown className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                            </button>
                        )}

                        {orgMenuOpen && (
                            <>
                                <button type="button" aria-label="Close organization list" className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)} />
                                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-[#151515]">
                                    <p className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Switch organization</p>
                                    {allOrgs.map(org => (
                                        <button key={org.id} type="button" onClick={() => handleSwitchOrg(org.id, org.name)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold dark:bg-white/10">{org.name.charAt(0).toUpperCase()}</span>
                                            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{org.name}</span><span className="block text-[10px] capitalize text-gray-500">{org.role}</span></span>
                                            {org.name === orgDetails?.name && <Check className="size-4 shrink-0" aria-hidden="true" />}
                                        </button>
                                    ))}
                                    <Link href="/onboarding" onClick={() => { setOrgMenuOpen(false); setMobileOpen(false) }} className="mt-1 flex items-center gap-2.5 border-t border-gray-100 px-2.5 py-3 text-xs font-medium text-gray-600 hover:text-black dark:border-white/10 dark:text-gray-300 dark:hover:text-white">
                                        <Plus className="size-4" /> Create organization
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {canCreate && (
                    <div className="px-4 pt-4">
                        <Link href="/dashboard/events/create" onClick={close} className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gray-950 text-sm font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black">
                            <Plus className="size-4" aria-hidden="true" /> New event
                        </Link>
                    </div>
                )}

                <nav aria-label="Dashboard navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                    <div className="space-y-1">
                        {navItems.map(item => {
                            const active = isActive(item.path)
                            return (
                                <Link key={item.path} href={item.path} onClick={close} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </div>
                </nav>

                <div className="space-y-1 border-t border-gray-100 px-3 pb-3 pt-3 dark:border-white/10">
                    <Link href="/dashboard/settings" onClick={close} aria-current={isActive('/dashboard/settings') ? 'page' : undefined} className={linkClass(isActive('/dashboard/settings'))}>
                        <Settings className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" /> Settings
                    </Link>
                    {(isSuperAdmin || isAdmin) && (
                        <Link href="/admin" onClick={close} className={linkClass(false)}>
                            <ShieldAlert className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" /> Platform admin
                        </Link>
                    )}

                    <div className="relative pt-2">
                        {loading ? (
                            <Skeleton className="h-12 w-full rounded-xl bg-gray-100 dark:bg-white/10" />
                        ) : (
                            <button type="button" onClick={() => setAccountOpen(o => !o)} aria-expanded={accountOpen} aria-haspopup="menu" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-medium">{user?.email}</span>
                                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">{role}</span>
                                </span>
                                <ChevronsUpDown className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                            </button>
                        )}
                        {accountOpen && (
                            <>
                                <button type="button" aria-label="Close account menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountOpen(false)} />
                                <div role="menu" className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-[#151515]">
                                    <Link role="menuitem" href="/dashboard/settings?tab=profile" onClick={close} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10"><UserRound className="size-4 text-gray-400" aria-hidden="true" /> Your profile</Link>
                                    <Link role="menuitem" href="/my-tickets" onClick={close} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10"><Ticket className="size-4 text-gray-400" aria-hidden="true" /> My tickets</Link>
                                    <a role="menuitem" href="/" target="_blank" rel="noopener noreferrer" onClick={close} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10"><ArrowUpRight className="size-4 text-gray-400" aria-hidden="true" /> View GatePass</a>
                                    <button role="menuitem" type="button" onClick={handleLogout} className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"><LogOut className="size-4 text-gray-400" aria-hidden="true" /> Sign out</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
