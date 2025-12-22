'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Helper to verify super admin status
async function verifySuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized: Not authenticated')
    }

    const { data: profile } = await supabase
        .schema('gatepass')
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    // Also check hardcoded admins as fallback
    const isHardcodedAdmin = ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com'].includes(user.email?.toLowerCase() || '')

    if (!profile?.is_super_admin && !isHardcodedAdmin) {
        throw new Error('Forbidden: Super Admin access required')
    }

    return user
}

export async function suspendUser(userId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100 years
    })

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}

export async function unsuspendUser(userId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '0'
    })

    if (error) return { error: error.message }
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
}

export async function deleteUser(userId: string) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) return { error: error.message }
    return { success: true }
}

export async function toggleSuperAdmin(userId: string, isSuperAdmin: boolean) {
    try {
        await verifySuperAdmin()
    } catch (e: any) {
        return { error: e.message }
    }

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
