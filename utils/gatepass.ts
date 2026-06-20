import { createClient } from '@/utils/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

export const createReservation = async (
    eventId: string,
    tierId: string,
    userId: string | null,
    quantity: number,
    supabaseClient?: SupabaseClient,
    guestDetails?: { email: string, name: string, phone: string },
    discountId?: string,
    addons?: Record<string, number>,
    metadata?: Record<string, unknown>
) => {
    const client = supabaseClient || createClient()

    // Verify virtual ticket tier quantity cap on server side
    const { data: tier } = await client
        .schema('gatepass')
        .from('ticket_tiers')
        .select('is_virtual')
        .eq('id', tierId)
        .single()

    if (tier?.is_virtual && quantity > 1) {
        throw new Error('Virtual / Remote access tickets are limited to 1 per order')
    }

    // 1. Create a reservation record
    console.log('Inserting Reservation with Discount ID:', discountId)
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
            guest_phone: guestDetails?.phone,
            discount_id: discountId,
            addons: addons, // Pass addons JSONB
            metadata: metadata // Pass metadata JSONB
        })
        .select()
        .single()

    if (error) throw error

    return data
}
