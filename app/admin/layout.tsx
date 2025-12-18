import { SuperAdminSidebar } from '@/components/layouts/SuperAdminSidebar'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Breadcrumbs } from '@/components/admin/Breadcrumbs'

export const metadata: Metadata = {
    title: 'Super Admin',
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    // Check if Super Admin
    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    const isHardcodedAdmin = ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com'].includes(user?.email?.toLowerCase() || '')

    if (!profile?.is_super_admin && !isHardcodedAdmin) {
        return redirect('/dashboard')
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#050505] flex font-sans selection:bg-red-500 selection:text-white">
            <SuperAdminSidebar />
            <main className="flex-1 overflow-x-hidden relative">
                <div className="absolute top-6 right-12 z-30">
                    <ThemeToggle />
                </div>
                <div className="p-12 min-h-screen text-gray-900 dark:text-white">
                    <Breadcrumbs />
                    {children}
                </div>
            </main>
        </div>
    )
}
