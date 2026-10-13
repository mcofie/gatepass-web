import type { SupabaseClient } from '@supabase/supabase-js'

let client: Promise<SupabaseClient> | null = null

/**
 * The browser Supabase client, loaded on first use. Public pages use this so the ~45 KB client
 * isn't part of the initial JavaScript: the page renders and becomes interactive first.
 */
export function getBrowserSupabase(): Promise<SupabaseClient> {
    if (!client) client = import('./client').then(m => m.createClient() as unknown as SupabaseClient)
    return client
}
