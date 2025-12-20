'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Approve (Mark as Paid)
export async function approvePayout(payoutId: string, reference?: string) {
    const supabase = await createClient()

    try {
        // Verify Super Admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) throw new Error('Unauthorized')

        const { error } = await supabase
            .schema('gatepass')
            .from('payouts')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                processed_by: user.id,
                reference: reference || null
            })
            .eq('id', payoutId)

        if (error) throw error

        revalidatePath('/admin/payouts')
        return { success: true }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

// Reject
export async function rejectPayout(payoutId: string, reason?: string) {
    const supabase = await createClient()

    try {
        // Verify Super Admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) throw new Error('Unauthorized')

        const { error } = await supabase
            .schema('gatepass')
            .from('payouts')
            .update({
                status: 'failed',
                processed_by: user.id,
                notes: reason ? `Rejected: ${reason}` : 'Rejected by admin'
            })
            .eq('id', payoutId)

        if (error) throw error

        revalidatePath('/admin/payouts')
        return { success: true }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}
