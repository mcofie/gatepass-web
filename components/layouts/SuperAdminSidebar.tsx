'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Banknote, LogOut, ShieldAlert, FileText } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { Skeleton } from '@/components/ui/skeleton'

export function SuperAdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }
        checkUser()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const isActive = (path: string) => {
        if (path === '/admin') return pathname === path
        return pathname.startsWith(path)
    }

    const navItems = [
        { name: 'Overview', path: '/admin', icon: LayoutDashboard },
        { name: 'Events', path: '/admin/events', icon: Calendar },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Financials', path: '/admin/financials', icon: Banknote },
        { name: 'Reports', path: '/admin/reports', icon: FileText },
    ]

    return (
        <aside className="w-72 bg-white dark:bg-[#000000] text-gray-900 dark:text-white flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto border-r border-gray-200 dark:border-white/10">
            {/* Brand */}
            <div className="p-8 pb-12">
                <Link href="/admin" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black font-bold shadow-lg shadow-black/10 dark:shadow-white/10 group-hover:scale-105 transition-transform">
                        <ShieldAlert className="w-5 h-5 text-red-500 dark:text-red-600" />
                    </div>
                    <div>
                        <h1 className="font-bold tracking-tight text-lg leading-tight text-gray-900 dark:text-white">
                            GatePass
                        </h1>
                        <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase">Super Admin</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl bg-white/5 text-gray-400 hover:bg-white hover:text-black transition-all duration-300 group border border-white/10"
                >
                    <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <div className="flex-1">
                        <p className="text-[11px] font-bold leading-none uppercase tracking-widest">Organizer Mode</p>
                        <p className="text-[9px] opacity-70 mt-0.5 font-medium leading-none">Return to Dashboard</p>
                    </div>
                </Link>

                <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">God Mode</p>

                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive(item.path)
                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg shadow-black/5 dark:shadow-white/5'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                            }`}
                    >
                        <item.icon className={`w-4 h-4 transition-colors ${isActive(item.path) ? 'text-white dark:text-black' : 'text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white'}`} />
                        {item.name}
                    </Link>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-200 dark:border-white/10">
                <div className="bg-gray-50 dark:bg-[#111] rounded-2xl p-1 mb-2 border border-gray-200 dark:border-white/10">
                    {loading ? (
                        <div className="flex items-center gap-3 px-3 py-2.5">
                            <Skeleton className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#222]" />
                            <div className="space-y-1">
                                <Skeleton className="w-32 h-3 bg-gray-200 dark:bg-[#222]" />
                                <Skeleton className="w-20 h-2 bg-gray-200 dark:bg-[#222]" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-3 py-2.5">
                            <div className="w-8 h-8 bg-gradient-to-tr from-red-600 to-red-500 dark:from-red-900 dark:to-red-800 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden flex-1">
                                <p className="text-[12px] font-medium text-gray-900 dark:text-white truncate">{user?.email}</p>
                                <p className="text-[10px] text-red-500 dark:text-red-400">System Operator</p>
                            </div>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-gray-500 dark:text-gray-400 text-[12px] font-medium hover:text-gray-900 dark:hover:text-white transition flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl"
                >
                    <LogOut className="w-3.5 h-3.5" /> Return to Login
                </button>
            </div>
        </aside>
    )
}
