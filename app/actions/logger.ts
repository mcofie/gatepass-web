'use server'

import { createClient } from '@/utils/supabase/server'

export async function logActivity(
    organizationId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: any = {}
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    try {
        await supabase.schema('gatepass').from('activity_logs').insert({
            organization_id: organizationId,
            user_id: user.id,
            action,
            entity_type: entityType,
            entity_id: entityId || null,
            metadata: metadata
        })
    } catch (e) {
        console.error('Failed to log activity:', e)
        // We don't throw here to avoid disrupting the main flow if logging fails
    }
}
