'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Add a user to the waitlist for a sold-out tier
 */
export async function joinWaitlist(eventId: string, tierId: string | undefined, email: string, name: string) {
    const supabase = await createClient()

    // Check if already on waitlist
    let query = supabase
        .schema('gatepass')
        .from('waitlist')
        .select('id')
        .eq('event_id', eventId)
        .eq('email', email.toLowerCase())

    if (tierId) {
        query = query.eq('tier_id', tierId)
    } else {
        query = query.is('tier_id', null)
    }

    const { data: existing } = await query.maybeSingle()

    if (existing) {
        return { error: tierId ? 'You are already on the waitlist for this ticket' : 'You are already on the waitlist for this event' }
    }

    // Add to waitlist
    const { error } = await supabase
        .schema('gatepass')
        .from('waitlist')
        .insert({
            event_id: eventId,
            tier_id: tierId || null,
            email: email.toLowerCase(),
            name: name
        })

    if (error) {
        console.error('Waitlist error:', error)
        return { error: error.message }
    }

    return { success: true, message: 'You have been added to the waitlist!' }
}

/**
 * Get waitlist count for a tier
 */
export async function getWaitlistCount(tierId: string) {
    const supabase = await createClient()

    const { count } = await supabase
        .schema('gatepass')
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('tier_id', tierId)
        .eq('notified', false)

    return count || 0
}
