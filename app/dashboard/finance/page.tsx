import { FinanceDashboard } from '@/components/admin/FinanceDashboard'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function FinancePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return redirect('/login')

    const admins = ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com']
    if (!admins.includes(user.email?.toLowerCase() || '')) {
        return redirect('/dashboard')
    }

    return <FinanceDashboard />
}
