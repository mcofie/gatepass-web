'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Duplicate an event with all its ticket tiers and addons
 */
export async function duplicateEvent(eventId: string) {
    const supabase = await createClient()

    // Get the original event
    const { data: originalEvent, error: eventError } = await supabase
        .schema('gatepass')
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

    if (eventError || !originalEvent) {
        return { error: 'Event not found' }
    }

    // Generate a unique slug for the duplicated event
    const baseSlug = `${originalEvent.slug}-copy`
    let newSlug = baseSlug
    let counter = 1

    // Check if slug exists and find available one
    while (true) {
        const { data: existing } = await supabase
            .schema('gatepass')
            .from('events')
            .select('id')
            .eq('slug', newSlug)
            .single()

        if (!existing) break
        newSlug = `${baseSlug}-${counter}`
        counter++
    }

    // Create the new event
    const { data: newEvent, error: createError } = await supabase
        .schema('gatepass')
        .from('events')
        .insert({
            title: `${originalEvent.title} (Copy)`,
            slug: newSlug,
            description: originalEvent.description,
            venue_name: originalEvent.venue_name,
            venue_address: originalEvent.venue_address,
            latitude: originalEvent.latitude,
            longitude: originalEvent.longitude,
            starts_at: originalEvent.starts_at,
            ends_at: originalEvent.ends_at,
            poster_url: originalEvent.poster_url,
            video_url: originalEvent.video_url,
            logo_url: originalEvent.logo_url,
            organizer_id: originalEvent.organizer_id, // Required: user who created it
            organization_id: originalEvent.organization_id,
            is_published: false, // New events start unpublished
            social_website: originalEvent.social_website,
            social_instagram: originalEvent.social_instagram,
            social_twitter: originalEvent.social_twitter,
            social_facebook: originalEvent.social_facebook,
            primary_color: originalEvent.primary_color,
            fee_bearer: originalEvent.fee_bearer,
            platform_fee_percent: originalEvent.platform_fee_percent,
            lineup: originalEvent.lineup,
        })
        .select()
        .single()

    if (createError || !newEvent) {
        return { error: createError?.message || 'Failed to create event' }
    }

    // Duplicate ticket tiers
    const { data: originalTiers } = await supabase
        .schema('gatepass')
        .from('ticket_tiers')
        .select('*')
        .eq('event_id', eventId)

    if (originalTiers && originalTiers.length > 0) {
        const tiersToInsert = originalTiers.map(tier => ({
            event_id: newEvent.id,
            name: tier.name,
            price: tier.price,
            currency: tier.currency,
            total_quantity: tier.total_quantity,
            quantity_sold: 0, // Reset sold count
            max_per_order: tier.max_per_order,
            description: tier.description,
            perks: tier.perks,
            is_visible: tier.is_visible,
            sort_order: tier.sort_order,
        }))

        await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .insert(tiersToInsert)
    }

    // Duplicate addons
    const { data: originalAddons } = await supabase
        .schema('gatepass')
        .from('event_addons')
        .select('*')
        .eq('event_id', eventId)

    if (originalAddons && originalAddons.length > 0) {
        const addonsToInsert = originalAddons.map(addon => ({
            event_id: newEvent.id,
            name: addon.name,
            description: addon.description,
            price: addon.price,
            max_quantity: addon.max_quantity,
            quantity_sold: 0, // Reset sold count
            is_active: addon.is_active,
        }))

        await supabase
            .schema('gatepass')
            .from('event_addons')
            .insert(addonsToInsert)
    }

    revalidatePath('/dashboard/events')

    return {
        success: true,
        eventId: newEvent.id,
        slug: newEvent.slug,
        message: 'Event duplicated successfully'
    }
}
