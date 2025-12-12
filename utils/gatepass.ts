import { createClient } from '@/utils/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

export const createReservation = async (eventId: string, tierId: string, userId: string, quantity: number, supabaseClient?: SupabaseClient) => {
    const client = supabaseClient || createClient()
    // 0. Ensure Profile Exists (Safety check)
    const { data: profile } = await client.schema('gatepass').from('profiles').select('id').eq('id', userId).single()

    if (!profile) {
        const { data: { user } } = await client.auth.getUser()
        if (user) {
            await client.schema('gatepass').from('profiles').insert({
                id: userId,
                full_name: user.user_metadata?.full_name || 'Customer',
                avatar_url: user.user_metadata?.avatar_url,
                updated_at: new Date().toISOString()
            })
        }
    }

    // 1. Create a reservation record
    const { data, error } = await client
        .schema('gatepass')
        .from('reservations')
        .insert({
            event_id: eventId,
            tier_id: tierId,
            user_id: userId,
            quantity: quantity,
            status: 'pending'
        })
        .select()
        .single()

    if (error) throw error

    return data
}
