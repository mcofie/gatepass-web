import { createClient } from '@/utils/supabase/server'
import { AdminSidebar } from '@/components/layouts/AdminSidebar'
import { Metadata } from 'next'
import { LoginNotification } from '@/components/admin/LoginNotification'
import { Suspense } from 'react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { DashboardAlerts } from '@/components/dashboard/DashboardAlerts'

export const metadata: Metadata = {
    title: 'Dashboard',
}

import { cookies } from 'next/headers'

// ...

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-black flex font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
            <Suspense fallback={null}>
                <LoginNotification />
            </Suspense>
            <AdminSidebar activeOrgId={activeOrgId} />
            <main className="flex-1 overflow-x-hidden relative">
                <header className="absolute top-0 left-0 right-0 h-24 flex items-center justify-between px-12 z-30 pointer-events-none">
                    <h2 className="font-bold text-2xl tracking-tight opacity-0">Dashboard</h2>
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <ThemeToggle />
                        <a href="/" target="_blank" className="text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors bg-white dark:bg-[#111] px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md">
                            View Live Site ↗
                        </a>
                    </div>
                </header>
                <div className="p-4 md:p-12 pt-24 min-h-screen">
                    <Suspense fallback={null}>
                        <DashboardAlerts />
                    </Suspense>
                    {children}
                </div>
            </main>
        </div>
    )
}
