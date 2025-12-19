'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateFeeSettings(platformFee: number, processorFee: number) {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Role check
    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) {
        throw new Error('Only super admins can update system settings')
    }

    // Update
    const value = {
        platform_fee_percent: platformFee,
        processor_fee_percent: processorFee
    }

    const { error } = await supabase
        .schema('gatepass')
        .from('system_settings')
        .upsert({
            key: 'fees',
            value: value,
            updated_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)

    revalidatePath('/admin/settings')
    return { success: true }
}
