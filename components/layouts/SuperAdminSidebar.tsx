'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Activity, Banknote, Calendar, FileText, Landmark, LayoutDashboard, LogOut, Menu, Settings, Users, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const NAV = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Events', path: '/admin/events', icon: Calendar },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Financials', path: '/admin/financials', icon: Banknote },
    { name: 'Payouts', path: '/admin/payouts', icon: Landmark },
    { name: 'Activity', path: '/admin/activity', icon: Activity },
    { name: 'Reports', path: '/admin/reports', icon: FileText },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
]

/** Platform admin navigation, styled like the organizer dashboard so both feel like one product. */
export function SuperAdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const [user, setUser] = useState<User | null>(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user))
    }, [supabase])

    const isActive = (path: string) => (path === '/admin' ? pathname === path : pathname.startsWith(path))
    const close = () => setOpen(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const linkClass = (active: boolean) => 'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ' + (active
        ? 'bg-gray-950 text-white dark:bg-white dark:text-black'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white')

    return (
        <>
            <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5 dark:border-white/10 dark:bg-[#0b0b0b] lg:hidden">
                <Link href="/admin" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                    <GatePassMark className="size-8" /> Admin
                </Link>
                <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" aria-expanded={open} className="flex size-9 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                    <Menu className="size-5" />
                </button>
            </div>
            {open && <button type="button" aria-label="Close admin menu" onClick={close} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />}

            <aside className={'fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] shrink-0 flex-col border-r border-gray-200 bg-white text-gray-950 transition-transform duration-200 dark:border-white/10 dark:bg-[#0b0b0b] dark:text-white lg:sticky lg:top-0 lg:translate-x-0 ' + (open ? 'translate-x-0' : '-translate-x-full')}>
                <div className="flex items-center justify-between px-5 pb-4 pt-5">
                    <Link href="/admin" onClick={close} className="flex items-center gap-2.5">
                        <GatePassMark className="size-8" />
                        <span>
                            <span className="block text-[15px] font-semibold leading-tight tracking-[-0.03em]">GatePass</span>
                            <span className="block text-[11px] text-gray-500 dark:text-gray-400">Platform admin</span>
                        </span>
                    </Link>
                    <button type="button" aria-label="Close admin menu" onClick={close} className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden"><X className="size-4" /></button>
                </div>

                <div className="px-3">
                    <Link href="/dashboard" onClick={close} className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white">
                        <ArrowLeft className="size-4" aria-hidden="true" /> Organizer dashboard
                    </Link>
                </div>

                <nav aria-label="Admin navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
                    {NAV.map(item => (
                        <Link key={item.path} href={item.path} onClick={close} aria-current={isActive(item.path) ? 'page' : undefined} className={linkClass(isActive(item.path))}>
                            <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="border-t border-gray-100 p-3 dark:border-white/10">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold dark:bg-white/10">{user?.email?.charAt(0).toUpperCase() || 'A'}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{user?.email ?? ' '}</span>
                            <span className="block text-[11px] text-gray-500 dark:text-gray-400">Platform admin</span>
                        </span>
                        <ThemeToggle />
                    </div>
                    <button type="button" onClick={handleLogout} className="mt-1 flex h-9 w-full items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white">
                        <LogOut className="size-4" aria-hidden="true" /> Sign out
                    </button>
                </div>
            </aside>
        </>
    )
}
