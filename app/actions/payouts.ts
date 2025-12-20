'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestPayout(eventId: string, amount: number, currency: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Get Organization for Event to verify ownership/membership
        const { data: event } = await supabase
            .schema('gatepass')
            .from('events')
            .select('organization_id')
            .eq('id', eventId)
            .single()

        if (!event) throw new Error('Event not found')

        // 2. Check Permissions (Owner or Team Member)
        const { data: orgMember } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('role')
            .eq('organization_id', event.organization_id)
            .eq('user_id', user.id)
            .single()

        const { data: orgOwner } = await supabase
            .schema('gatepass')
            .from('organizers')
            .select('id')
            .eq('id', event.organization_id)
            .eq('user_id', user.id)
            .single()

        if (!orgMember && !orgOwner) {
            throw new Error('You do not have permission to request payouts for this event')
        }

        // 3. Check for existing pending/processing payouts
        const { data: existing } = await supabase
            .schema('gatepass')
            .from('payouts')
            .select('id')
            .eq('event_id', eventId)
            .in('status', ['pending', 'processing'])
            .maybeSingle()

        if (existing) {
            throw new Error('You already have a pending payout request. Please wait for it to be processed.')
        }

        // 4. Create Payout Request
        const { error } = await supabase
            .schema('gatepass')
            .from('payouts')
            .insert({
                event_id: eventId,
                organizer_id: event.organization_id,
                amount: amount,
                currency: currency,
                status: 'pending',
                notes: `Payout request initiated by user ${user.email}`
            })

        if (error) throw error

        revalidatePath(`/dashboard/events/${eventId}`)
        return { success: true }

    } catch (error: any) {
        console.error('Request Payout Error:', error)
        return { success: false, message: error.message }
    }
}
