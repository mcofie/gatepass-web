'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, LogOut, LayoutDashboard, Settings, Banknote, Activity, Users, ScanLine, Sparkles, History } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [user, setUser] = useState<User | null>(null)
    const [isOwner, setIsOwner] = useState(false)
    const [orgDetails, setOrgDetails] = useState<{ name: string } | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkOwner = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            if (user) {
                // Check if Owner
                const { data: ownerData } = await supabase.schema('gatepass').from('organizers').select('id, name').eq('user_id', user.id).single()
                if (ownerData) {
                    setIsOwner(true)
                    setOrgDetails({ name: ownerData.name })
                } else {
                    // Check if Staff
                    const { data: staffData } = await supabase.schema('gatepass').from('organization_team').select('organization:organization_id(name)').eq('user_id', user.id).single()
                    if (staffData && staffData.organization) {
                        // @ts-ignore
                        setOrgDetails({ name: staffData.organization.name })
                    }
                }
            }
            setLoading(false)
        }
        checkOwner()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const isActive = (path: string) => {
        if (path === '/dashboard') return pathname === path
        return pathname.startsWith(path)
    }

    const isAdmin = user && ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com'].includes(user.email?.toLowerCase() || '')

    const navItems = [
        { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Live Monitor', path: '/dashboard/monitor', icon: Activity },
        { name: 'Scan Tickets', path: '/dashboard/scan', icon: ScanLine },
        { name: 'Customers', path: '/dashboard/customers', icon: Users },
        { name: 'Events', path: '/dashboard/events', icon: Calendar },
        ...(isOwner ? [{ name: 'Activity Log', path: '/dashboard/activity', icon: History }] : []),
        ...(isAdmin ? [
            { name: 'Curate Feed', path: '/dashboard/curate', icon: Sparkles },
            { name: 'Finance', path: '/dashboard/finance', icon: Banknote }
        ] : []),
        { name: 'Settings', path: '/dashboard/settings', icon: Settings },
    ]

    return (
        <aside className="w-72 bg-[#0a0a0a] text-white flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto border-r border-[#1a1a1a]">
            {/* Brand */}
            <div className="p-8 pb-12">
                {loading ? (
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl bg-[#222]" />
                        <div className="space-y-1">
                            <Skeleton className="w-24 h-4 bg-[#222]" />
                            <Skeleton className="w-16 h-2 bg-[#222]" />
                        </div>
                    </div>
                ) : (
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-bold shadow-lg shadow-white/10 group-hover:scale-105 transition-transform">
                            {orgDetails?.name ? orgDetails.name.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div>
                            <h1 className="font-bold tracking-tight text-lg leading-tight">
                                {orgDetails?.name || 'GatePass.'}
                            </h1>
                            {orgDetails?.name && <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Organization</p>}
                        </div>
                    </Link>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1">
                <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Main Menu</p>

                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive(item.path)
                            ? 'bg-white text-black shadow-lg shadow-white/5'
                            : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                            }`}
                    >
                        <item.icon className={`w-4 h-4 transition-colors ${isActive(item.path) ? 'text-black' : 'text-gray-500 group-hover:text-white'}`} />
                        {item.name}
                    </Link>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-[#1a1a1a]">
                <div className="bg-[#111] rounded-2xl p-1 mb-2 border border-[#1a1a1a]">
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
                                <p className="text-[10px] text-gray-500">Administrator</p>
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
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full"></span>
                    GatePass
                </p>
            </div>
        </aside>
    )
}
