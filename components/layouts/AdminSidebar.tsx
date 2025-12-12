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
        <aside className="w-64 bg-black text-white flex-shrink-0 flex flex-col min-h-screen">
            <div className="p-6 border-b border-gray-800">
                <Link href="/" className="text-2xl font-black tracking-tighter flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded-lg"></div>
                    GATEPASS.
                </Link>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Menu</p>

                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${isActive(item.path) ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-3 px-4 py-3 mb-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-medium text-white truncate w-32">{user?.email}</p>
                        <p className="text-[10px] text-gray-500">Administrator</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-400 text-sm hover:text-red-300 transition flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign Out
                </button>
            </div>
        </aside>
    )
}
