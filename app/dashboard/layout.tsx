import { createClient } from '@/utils/supabase/server'
import { AdminSidebar } from '@/components/layouts/AdminSidebar'
import { Metadata } from 'next'
import { LoginNotification } from '@/components/admin/LoginNotification'
import { Suspense } from 'react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Dashboard',
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let needsSettlement = false

    if (user) {
        // Check Owner
        const { data: ownerOrg } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('paystack_subaccount_code')
            .eq('user_id', user.id)
            .single()

        if (ownerOrg) {
            needsSettlement = !ownerOrg.paystack_subaccount_code
        } else {
            // Check Team
            const { data: teamMember } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('organizers(paystack_subaccount_code)')
                .eq('user_id', user.id)
                .single()

            if (teamMember && teamMember.organizers) {
                // @ts-ignore
                needsSettlement = !teamMember.organizers.paystack_subaccount_code
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-black flex font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
            <Suspense fallback={null}>
                <LoginNotification />
            </Suspense>
            <AdminSidebar />
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
                <div className="p-12 pt-24 min-h-screen">
                    {needsSettlement && (
                        <div className="mb-8 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 fade-in duration-500">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Action Required: Enable Payouts</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        You have not connected a settlement account yet. You cannot receive payouts from ticket sales.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/settings"
                                className="whitespace-nowrap px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                Connect Bank <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    )}
                    {children}
                </div>
            </main>
        </div>
    )
}
