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
