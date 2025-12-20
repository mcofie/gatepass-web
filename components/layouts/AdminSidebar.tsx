'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    Calendar,
    LogOut,
    LayoutDashboard,
    Settings,
    Activity,
    Users,
    ScanLine,
    History,
    ShieldAlert,

    ChevronDown,
    Plus,
    Menu,
    X,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminSidebar() {
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

            // Owner?
            const { data: ownerData } = await supabase
                .schema('gatepass')
                .from('organizers')
                .select('id, name')
                .eq('user_id', authedUser.id)
                .maybeSingle()

            if (!mounted) return

            if (ownerData) {
                setIsOwner(true)
                setRole('Owner')
                setOrgDetails({ name: ownerData.name })
            } else {
                setIsOwner(false)

                // Staff?
                const { data: teamData } = await supabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('role, organization:organization_id(name)')
                    .eq('user_id', authedUser.id)
                    .maybeSingle()

                if (!mounted) return

                const orgName = (teamData as any)?.organization?.name ?? null
                const rawRole = (teamData as any)?.role ?? 'Staff'
                setRole(rawRole.charAt(0).toUpperCase() + rawRole.slice(1))

                setOrgDetails(orgName ? { name: orgName } : null)
            }

            // Super Admin?
            const { data: profile, error: profileError } = await supabase
                .schema('gatepass')
                .from('profiles')
                .select('is_super_admin')
                .eq('id', authedUser.id)
                .maybeSingle()

            console.log('AdminSidebar Debug:', { authedUser: authedUser.email, profile, profileError })

            if (!mounted) return
            setIsSuperAdmin(!!profile?.is_super_admin)

            setLoading(false)
        }

        run()

        return () => {
            mounted = false
        }
    }, [supabase])

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

    const navItems = useMemo(() => {
        return [
            { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
            ...(role !== 'Staff' ? [{ name: 'Live Monitor', path: '/dashboard/monitor', icon: Activity }] : []),
            { name: 'Scan Tickets', path: '/dashboard/scan', icon: ScanLine },
            { name: 'Customers', path: '/dashboard/customers', icon: Users },
            { name: 'Events', path: '/dashboard/events', icon: Calendar },
            ...(isOwner ? [{ name: 'Activity Log', path: '/dashboard/activity', icon: History }] : []),
            { name: 'Settings', path: '/dashboard/settings', icon: Settings },
        ]
    }, [isOwner, isAdmin, isSuperAdmin, role])

    return (
        <>
            {/* Mobile Header Trigger */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0a0a] z-40 flex items-center justify-between px-6 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black font-bold">
                        {orgDetails?.name ? orgDetails.name.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <span className="font-bold text-white tracking-tight">GatePass</span>
                </div>
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 text-gray-400 hover:text-white"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Backdrop */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside className={`
                w-72 bg-[#0a0a0a] text-white flex-shrink-0 flex flex-col h-screen overflow-y-auto border-r border-[#1a1a1a]
                fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
                lg:translate-x-0 lg:static lg:h-screen
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="lg:hidden absolute top-4 right-4 z-[60]">
                    <button onClick={() => setMobileOpen(false)} className="p-2 text-gray-400 hover:text-white bg-black/50 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Brand */}
                <div className="p-8 pb-12 relative z-50">
                    {loading ? (
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-xl bg-[#222]" />
                            <div className="space-y-1">
                                <Skeleton className="w-24 h-4 bg-[#222]" />
                                <Skeleton className="w-16 h-2 bg-[#222]" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/dashboard" className="flex items-center gap-3 group flex-1">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-bold shadow-lg shadow-white/10 group-hover:scale-105 transition-transform">
                                    {orgDetails?.name ? orgDetails.name.charAt(0).toUpperCase() : 'G'}
                                </div>
                                <div>
                                    <h1 className="font-bold tracking-tight text-lg leading-tight">
                                        {orgDetails?.name || 'GatePass.'}
                                    </h1>
                                    {orgDetails?.name && (
                                        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
                                            Organization
                                        </p>
                                    )}
                                </div>
                            </Link>

                            <div className="relative">
                                <button
                                    onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                                    className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Organization Popover */}
                                {orgMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setOrgMenuOpen(false)}
                                        />
                                        <div className="absolute top-full right-0 mt-2 w-56 bg-[#111] border border-[#222] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-2">
                                                <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-gray-500 font-bold">Switch Organization</p>
                                                <button className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1a1a1a] text-white">
                                                    <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">
                                                        {orgDetails?.name?.charAt(0) || 'G'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold truncate">{orgDetails?.name || 'GatePass'}</p>
                                                        <p className="text-[10px] text-gray-400">Current</p>
                                                    </div>
                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                </button>

                                                <button className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors mt-1">
                                                    <div className="w-6 h-6 rounded border border-[#333] flex items-center justify-center">
                                                        <Plus className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-xs font-medium">Create Organization</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-1">
                    <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                        Main Menu
                    </p>

                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive(item.path)
                                ? 'bg-white text-black shadow-lg shadow-white/5'
                                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                                }`}
                        >
                            <item.icon
                                className={`w-4 h-4 transition-colors ${isActive(item.path) ? 'text-black' : 'text-gray-500 group-hover:text-white'
                                    }`}
                            />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* User Profile & Admin Switch */}
                <div className="p-4 border-t border-[#1a1a1a] space-y-4">
                    {(isSuperAdmin || isAdmin) && (
                        <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 group border border-red-500/20"
                        >
                            <ShieldAlert className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            <div className="flex-1">
                                <p className="text-[11px] font-bold leading-none uppercase tracking-widest">God Mode</p>
                                <p className="text-[9px] opacity-70 mt-0.5 font-medium leading-none">Switch to Super Admin</p>
                            </div>
                        </Link>
                    )}

                    <div className="bg-[#111] rounded-2xl p-1 border border-[#1a1a1a]">
                        {loading ? (
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <Skeleton className="w-8 h-8 rounded-full bg-[#222]" />
                                <div className="space-y-1">
                                    <Skeleton className="w-32 h-3 bg-[#222]" />
                                    <Skeleton className="w-20 h-2 bg-[#222]" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <div className="w-8 h-8 bg-gradient-to-tr from-gray-700 to-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner">
                                    {user?.email?.charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <p className="text-[12px] font-medium text-white truncate">{user?.email}</p>
                                    <p className="text-[10px] text-gray-500">{role}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-red-400 text-[12px] font-medium hover:text-red-300 transition flex items-center gap-2 hover:bg-red-950/10 rounded-xl"
                    >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                </div>

                <div className="px-8 pb-8 pt-2 text-center">
                    <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest flex items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <span className="w-1.5 h-1.5 bg-gray-600 rounded-full" />
                        GatePass
                    </p>
                </div>
            </aside>
        </>
    )
}