import { AdminSidebar } from '@/components/layouts/AdminSidebar'
import { Metadata } from 'next'
import { LoginNotification } from '@/components/admin/LoginNotification'
import { Suspense } from 'react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { ArrowUpRight } from 'lucide-react'
import { DashboardAlerts } from '@/components/dashboard/DashboardAlerts'

export const metadata: Metadata = {
    title: 'Dashboard',
}

import { cookies } from 'next/headers'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const activeOrgId = cookieStore.get('gatepass-org-id')?.value

    return (
        <div className="flex min-h-screen bg-[#fafafa] font-sans text-gray-950 selection:bg-black selection:text-white dark:bg-[#080808] dark:text-white dark:selection:bg-white dark:selection:text-black">
            <Suspense fallback={null}>
                <LoginNotification />
            </Suspense>
            <AdminSidebar activeOrgId={activeOrgId} />
            <main className="min-w-0 flex-1 overflow-x-hidden">
                <header className="sticky top-0 z-30 hidden h-16 items-center justify-end gap-3 border-b border-gray-200 bg-white/95 px-8 backdrop-blur dark:border-white/10 dark:bg-[#0b0b0b]/95 lg:flex">
                        <ThemeToggle />
                        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 px-3.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black dark:border-white/15 dark:text-gray-300 dark:hover:text-white">View site <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
                </header>
                <div className="min-h-screen px-5 pb-10 pt-24 sm:px-8 lg:px-10 lg:pt-9">
                    <Suspense fallback={null}>
                        <DashboardAlerts />
                    </Suspense>
                    {children}
                </div>
            </main>
        </div>
    )
}
