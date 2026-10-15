import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/utils/supabase/admin'

/** Every sign-in record, keyed by user id. They hold join and last-seen dates; profiles don't. */
export async function listAuthUsers() {
    const admin = createAdminClient()
    const all: User[] = []
    for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (error || !data?.users.length) break
        all.push(...data.users)
        if (data.users.length < 1000) break
    }
    return new Map(all.map(u => [u.id, u]))
}
