import { createClient } from '@/utils/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

export const createReservation = async (
    eventId: string,
    tierId: string,
    userId: string | null,
    quantity: number,
    supabaseClient?: SupabaseClient,
    guestDetails?: { email: string, name: string, phone: string }
) => {
    const client = supabaseClient || createClient()

    // 0. Ensure Profile Exists (Safety check) - Only if userId is provided
    if (userId) {
        const { data: profile } = await client.schema('gatepass').from('profiles').select('id').eq('id', userId).single()

        if (!profile) {
            const { data: { user } } = await client.auth.getUser()
            if (user && user.id === userId) {
                await client.schema('gatepass').from('profiles').insert({
                    id: userId,
                    full_name: user.user_metadata?.full_name || 'Customer',
                    avatar_url: user.user_metadata?.avatar_url,
                    updated_at: new Date().toISOString()
                })
            }
        }
    }

    // 0b. Inventory Check
    const { data: tier, error: tierError } = await client
        .schema('gatepass')
        .from('ticket_tiers')
        .select('total_quantity, quantity_sold')
        .eq('id', tierId)
        .single()

    if (tierError) throw new Error('Failed to fetch ticket tier details')

    if (tier.quantity_sold + quantity > tier.total_quantity) {
        throw new Error('Tickets are sold out for this tier')
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
            status: 'pending',
            guest_email: guestDetails?.email,
            guest_name: guestDetails?.name,
            guest_phone: guestDetails?.phone
        })
        .select()
        .single()

    if (error) throw error

    return data
}
