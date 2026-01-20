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
    metadata?: Record<string, any>
) => {
    const client = supabaseClient || createClient()

    // ... (lines 16-48 unchanged)

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
