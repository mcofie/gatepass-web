import { AdminSidebar } from '@/components/layouts/AdminSidebar'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex">
            <AdminSidebar />
            <main className="flex-1 overflow-x-hidden">
                <header className="bg-white border-b h-16 flex items-center justify-between px-8 sticky top-0 z-30">
                    <h2 className="font-bold text-lg capitalize">Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <a href="/" target="_blank" className="text-sm text-gray-500 hover:text-black hover:underline">View Live Site ↗</a>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
