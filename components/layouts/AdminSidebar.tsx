'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, LogOut, LayoutDashboard, Settings } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user))
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

    const navItems = [
        { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Events', path: '/dashboard/events', icon: Calendar },
        { name: 'Settings', path: '/dashboard/settings', icon: Settings },
    ]

    return (
        <aside className="w-72 bg-[#0a0a0a] text-white flex-shrink-0 flex flex-col min-h-screen border-r border-[#1a1a1a]">
            {/* Brand */}
            <div className="p-8 pb-12">
                <Link href="/" className="text-xl font-bold tracking-tighter flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black text-[10px] font-black pointer-events-none">GP</div>
                    GatePass.
                </Link>
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
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-8 h-8 bg-gradient-to-tr from-gray-700 to-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-[12px] font-medium text-white truncate">{user?.email}</p>
                            <p className="text-[10px] text-gray-500">Administrator</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-red-400 text-[12px] font-medium hover:text-red-300 transition flex items-center gap-2 hover:bg-red-950/10 rounded-xl"
                >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
            </div>
        </aside>
    )
}
