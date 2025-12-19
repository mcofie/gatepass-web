'use client'

import { usePathname } from 'next/navigation'
import { NavBar } from '@/components/common/NavBar'
import { Footer } from '@/components/common/Footer'

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isDashboard = pathname?.startsWith('/dashboard')
    const isAdmin = pathname?.startsWith('/admin')
    const isStudio = pathname?.startsWith('/studio')
    const isTicket = pathname?.startsWith('/tickets/')

    // Hide global nav/footer on dashboard, admin, studio, and ticket pages
    const shouldHideGlobalNav = isDashboard || isAdmin || isStudio || isTicket

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
