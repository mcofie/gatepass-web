'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function suspendUser(userId: string) {
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100 years
    })

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}

export async function unsuspendUser(userId: string) {
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '0'
    })

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}

export async function deleteUser(userId: string) {
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) return { error: error.message }
    return { success: true }
}

export async function toggleSuperAdmin(userId: string, isSuperAdmin: boolean) {
    const supabase = createAdminClient()

    // Update profile
    const { error } = await supabase
        .schema('gatepass')
        .from('profiles')
        .update({ is_super_admin: isSuperAdmin })
        .eq('id', userId)

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}
