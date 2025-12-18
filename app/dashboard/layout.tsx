import { AdminSidebar } from '@/components/layouts/AdminSidebar'
import { Metadata } from 'next'
import { LoginNotification } from '@/components/admin/LoginNotification' // Import the component
import { Suspense } from 'react'

export const metadata: Metadata = {
    title: 'Dashboard',
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[#FAFAFA] flex font-sans selection:bg-black selection:text-white">
            <Suspense fallback={null}>
                <LoginNotification />
            </Suspense>
            <AdminSidebar />
            <main className="flex-1 overflow-x-hidden relative">
                <header className="absolute top-0 left-0 right-0 h-24 flex items-center justify-between px-12 z-30 pointer-events-none">
                    <h2 className="font-bold text-2xl tracking-tight opacity-0">Dashboard</h2> {/* Hidden for layout, real title in page */}
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <a href="/" target="_blank" className="text-[13px] font-medium text-gray-500 hover:text-black transition-colors bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md">
                            View Live Site ↗
                        </a>
                    </div>
                </header>
                <div className="p-12 pt-24 min-h-screen">
                    {children}
                </div>
            </main>
        </div>
    )
}
