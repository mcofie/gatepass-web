import { SuperAdminSidebar } from '@/components/layouts/SuperAdminSidebar'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { Breadcrumbs } from '@/components/admin/Breadcrumbs'

export const metadata: Metadata = {
    title: 'Platform admin',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    // Platform admins only, by flag
    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) {
        return redirect('/dashboard')
    }

    return (
        <div className="flex min-h-screen bg-[#fafafa] font-sans text-gray-950 selection:bg-black selection:text-white dark:bg-[#080808] dark:text-white dark:selection:bg-white dark:selection:text-black">
            <SuperAdminSidebar />
            <main className="min-w-0 flex-1 overflow-x-hidden">
                <div className="mx-auto min-h-screen max-w-[1240px] px-5 pb-12 pt-24 sm:px-8 lg:px-10 lg:pt-10">
                    <Breadcrumbs />
                    {children}
                </div>
            </main>
        </div>
    )
}
