'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function switchOrganization(orgId: string, redirectTo: string = '/dashboard') {
    const cookieStore = await cookies()

    // Set cookie for 30 days
    cookieStore.set('gatepass-org-id', orgId, {
        secure: true,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
    })

    revalidatePath('/dashboard')
    redirect(redirectTo) // Force reload to ensure all RSCs pick up new context
}

/** Makes an organization the active workspace without navigating (used mid-onboarding). Members only. */
export async function setActiveOrganization(orgId: string) {
    const { createClient } = await import('@/utils/supabase/server')
    const { createAdminClient } = await import('@/utils/supabase/admin')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const admin = createAdminClient().schema('gatepass')
    const { data: org } = await admin.from('organizers').select('user_id').eq('id', orgId).maybeSingle()
    const isOwner = org?.user_id === user.id
    const isMember = isOwner || Boolean((await admin.from('organization_team').select('user_id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()).data)
    if (!isMember) throw new Error('You’re not a member of this organization')

    const cookieStore = await cookies()
    cookieStore.set('gatepass-org-id', orgId, { secure: true, httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: '/' })
    revalidatePath('/dashboard')
}
