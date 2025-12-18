'use client'

import { usePathname } from 'next/navigation'
import { NavBar } from '@/components/common/NavBar'
import { Footer } from '@/components/common/Footer'

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isDashboard = pathname?.startsWith('/dashboard')
    const isAdmin = pathname?.startsWith('/admin')
    const isStudio = pathname?.startsWith('/studio')

    // Hide global nav/footer on dashboard, admin, and studio
    const shouldHideGlobalNav = isDashboard || isAdmin || isStudio

    return (
        <>
            {!shouldHideGlobalNav && <NavBar />}
            <main className="min-h-screen">
                {children}
            </main>
            {!shouldHideGlobalNav && <Footer />}
        </>
    )
}
