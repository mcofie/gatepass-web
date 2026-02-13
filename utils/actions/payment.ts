import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { Ticket } from '@/types/gatepass'
import { calculateFees, getEffectiveFeeRates } from '@/utils/fees'
import { getFeeSettings } from '@/utils/settings'
import { randomBytes } from 'crypto'

export type PaymentResult = {
    success: boolean
    tickets?: Ticket[]
    message?: string
    error?: string
}

export async function processSuccessfulPayment(reference: string, reservationId?: string | string[], transactionData?: any, addons?: Record<string, number>): Promise<PaymentResult> {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing.')
        return { success: false, error: 'Server Configuration Error' }
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
    )

    // 0. Ensure we have transaction data
    let tx = transactionData
    if (!tx) {
        try {
            tx = await verifyPaystackTransaction(reference)
        } catch (e) {
            console.error('Failed to verify transaction for history:', e)
            return { success: false, error: 'Payment verification failed' }
        }
    }

    if (tx.status !== 'success') {
        return { success: false, error: 'Payment was not successful' }
    }

    // 2. Fetch Reservations (Handling Multiple)
    let reservationIds: string[] = Array.isArray(reservationId) ? reservationId : (reservationId ? [reservationId] : [])

    // Auto-discovery from Metadata (if missing form arguments)
    if (reservationIds.length === 0 && tx?.metadata) {
        let metaIds = tx.metadata.reservation_ids

        if (typeof metaIds === 'string') {
            metaIds = metaIds.split(',').map((s: string) => s.trim())
        }

        // Fallback to custom fields
        if ((!metaIds || !Array.isArray(metaIds)) && tx.metadata.custom_fields) {
            const field = tx.metadata.custom_fields.find((f: any) => f.variable_name === 'reservation_ids')
            if (field?.value) {
                metaIds = field.value.split(',').map((s: string) => s.trim())
            }
        }

        if (Array.isArray(metaIds) && metaIds.length > 0) {
            reservationIds = metaIds
        }
    }

    let reservations: any[] = []

    if (reservationIds.length > 0) {
        const { data, error } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select('*, ticket_tiers(*), events(*)')
            .in('id', reservationIds)

        if (error) {
            console.error('Reservations Fetch Error:', error)
            return { success: false, error: 'Failed to find reservations' }
        }
        reservations = data || []
    } else {
        // Fallback: Try finding by ID=Reference (Legacy)
        const { data, error } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select('*, ticket_tiers(*), events(*)')
            .eq('id', reference)
            .maybeSingle() // Use maybeSingle to avoid error if 0

        if (data) reservations = [data]
    }

    if (reservations.length === 0) {
        return { success: false, error: `No reservations found for IDs: ${reservationIds.join(', ')} or Ref: ${reference}` }
    }

    // 3. Pre-Calculate Fees & Prepare Data
    let totalPlatformFee = 0
    let totalProcessorFee = 0
    const allTickets: Ticket[] = []

    // We use the first event/settings for the transaction log rates (approximation if mixed, but usually same event)
    let primaryEvent = reservations[0].events
    // Fetch Organizer for primary event if needed
    if (Array.isArray(primaryEvent)) primaryEvent = primaryEvent[0]

    // Check Organizer for primary
    let primaryOrganizer = null
    if (primaryEvent?.organizer_id) {
        const { data: org } = await supabase.schema('gatepass').from('organizers').select('*').eq('id', primaryEvent.organizer_id).single()
        primaryOrganizer = org
    }

    // Loop to Calculate Fees
    for (const reservation of reservations) {
        let event = Array.isArray(reservation.events) ? reservation.events[0] : reservation.events
        // Ensure organizer attached
        if (event.id === primaryEvent.id && primaryOrganizer) {
            event.organizers = primaryOrganizer
        } else if (event.organizer_id) {
            // Fetch if specific event different
            const { data: org } = await supabase.schema('gatepass').from('organizers').select('*').eq('id', event.organizer_id).single()
            event.organizers = org
        }

        const ticketTier = Array.isArray(reservation.ticket_tiers) ? reservation.ticket_tiers[0] : reservation.ticket_tiers

        const globalSettings = await getFeeSettings()
        const effectiveRates = getEffectiveFeeRates(globalSettings, event, event.organizers)
        const feeBearer = event?.fee_bearer || 'customer'

        const price = ticketTier?.price || 0
        const qty = reservation.quantity || 1

        // Discount
        let subtotal = price * qty
        if (reservation.discount_id) {
            const { data: disc } = await supabase.schema('gatepass').from('discounts').select('*').eq('id', reservation.discount_id).single()
            if (disc) {
                if (disc.type === 'percentage') subtotal = subtotal - (subtotal * (disc.value / 100))
                else subtotal = Math.max(0, subtotal - disc.value)
            }
        }

        // Addons
        // Use provided addons arg ONLY if single reservation, otherwise rely on DB
        const currentAddons = (reservations.length === 1 && addons) ? addons : reservation.addons
        let addonSubtotal = 0
        if (currentAddons) {
            const addonIds = Object.keys(currentAddons)
            if (addonIds.length > 0) {
                const { data: addonData } = await supabase.schema('gatepass').from('event_addons').select('id, price').in('id', addonIds)
                if (addonData) {
                    addonData.forEach(a => {
                        const q = currentAddons[a.id] || 0
                        addonSubtotal += a.price * q
                    })
                }
            }
        }

        const { platformFee, processorFee } = calculateFees(subtotal, addonSubtotal, feeBearer, effectiveRates)

        totalPlatformFee += platformFee
        totalProcessorFee += processorFee

        // Attach processed data to reservation object for next step
        reservation._calc = {
            ticketTier,
            effectiveRates,
            finalAddons: currentAddons,
            platformFee, // Per reservation fee
            processorFee
        }
        reservation.events = event // Updated with organizer
    }

    // 4. Log Transaction (One Master Record)
    // We pick the first effective rate to log, as mixed rates in one TX is complex to log flat.
    const masterRates = reservations[0]._calc.effectiveRates
    const { error: txError } = await supabase.schema('gatepass').from('transactions').insert({
        reservation_id: reservations[0].id, // Link to primary
        reference,
        amount: tx.amount ? tx.amount / 100 : 0,
        currency: tx.currency,
        channel: tx.channel,
        status: tx.status,
        paid_at: tx.paid_at || tx.paidAt,
        metadata: { ...tx, reservation_ids: reservations.map((r: any) => r.id) }, // Log all IDs
        platform_fee: totalPlatformFee,
        applied_fee_rate: masterRates.platformFeePercent,
        applied_processor_fee: totalProcessorFee, // Sum
        applied_processor_rate: masterRates.processorFeePercent
    })

    if (txError) {
        console.error('Transaction Log Error:', txError)
    }

    // 5. Process Tickets (Loop) - Email moved outside loop
    let anyTicketsCreated = false
    let targetEmail: string | null = null
    let customerName: string = 'Guest'
    let emailPrimaryEvent: any = null
    let primaryPosterUrl: string | null = null

    // Collect tickets grouped by tier for consolidated email
    const ticketGroupsForEmail: { tierName: string; tickets: { id: string; qrCodeUrl: string }[] }[] = []

    for (const reservation of reservations) {
        const { ticketTier, effectiveRates, finalAddons } = reservation._calc
        const event = reservation.events
        let ticketsToProcess: Ticket[] = []
        let ticketsCreatedThisReservation = false

        // Capture email target and customer name from first reservation
        if (!targetEmail) {
            targetEmail = reservation.profiles?.email || reservation.guest_email
            customerName = reservation.profiles?.full_name || reservation.guest_name || 'Guest'
            emailPrimaryEvent = event

            // Resolve poster URL
            let posterUrl = event?.poster_url
            if (posterUrl && !posterUrl.startsWith('http')) {
                const { data: { publicUrl } } = supabase.storage.from('posters').getPublicUrl(posterUrl)
                posterUrl = publicUrl
            }
            primaryPosterUrl = posterUrl
        }

        // Idempotency: Check Status
        if (reservation.status === 'confirmed') {
            const { data: existing } = await supabase.schema('gatepass').from('tickets').select('*').eq('reservation_id', reservation.id)
            if (existing && existing.length > 0) {
                ticketsToProcess = existing as Ticket[]
            }
        } else {
            // Also check by ID if status pending
            const { data: existing } = await supabase.schema('gatepass').from('tickets').select('*').eq('reservation_id', reservation.id)
            if (existing && existing.length > 0) {
                ticketsToProcess = existing as Ticket[]
            }
        }

        // Create Tickets if none
        if (ticketsToProcess.length === 0) {
            const quantity = reservation.quantity || 1
            ticketsCreatedThisReservation = true
            anyTicketsCreated = true

            for (let i = 0; i < quantity; i++) {
                const { data: ticket, error: tErr } = await supabase
                    .schema('gatepass')
                    .from('tickets')
                    .insert({
                        user_id: reservation.user_id,
                        event_id: reservation.event_id,
                        tier_id: ticketTier.id,
                        reservation_id: reservation.id,
                        qr_code_hash: randomBytes(16).toString('hex').toUpperCase(),
                        order_reference: `${reference}-${reservation.id.slice(0, 4)}-${i + 1}`, // Unique Ref: Ref - ResID Partial - Index
                        status: 'valid'
                    })
                    .select()
                    .single()

                if (ticket) ticketsToProcess.push({ ...ticket as Ticket, reservations: reservation })
                else if (tErr) console.error('Ticket Insert Error:', tErr)
            }

            // Update Reservation
            await supabase.schema('gatepass').from('reservations').update({ status: 'confirmed', addons: finalAddons }).eq('id', reservation.id)

            // Increment Inventory
            const { error: rpcErr } = await supabase.rpc('increment_ticket_sold', { tier_id: ticketTier.id, qty: quantity })

            if (rpcErr) {
                // Fallback
                const { data: t } = await supabase.schema('gatepass').from('ticket_tiers').select('quantity_sold').eq('id', ticketTier.id).single()
                if (t) await supabase.schema('gatepass').from('ticket_tiers').update({ quantity_sold: (t.quantity_sold || 0) + quantity }).eq('id', ticketTier.id)
            }

            // Addons Inventory
            if (finalAddons) {
                for (const [aid, qty] of Object.entries(finalAddons as Record<string, number>)) {
                    // Simplified update
                    if (qty > 0) {
                        const { data: ad } = await supabase.schema('gatepass').from('event_addons').select('quantity_sold').eq('id', aid).single()
                        if (ad) await supabase.schema('gatepass').from('event_addons').update({ quantity_sold: (ad.quantity_sold || 0) + Number(qty) }).eq('id', aid)
                    }
                }
            }

            // Increment Discount Usage
            if (reservation.discount_id) {
                try {
                    await supabase.rpc('increment_discount_usage', { p_discount_id: reservation.discount_id })
                } catch (discErr) {
                    console.error('Failed to increment discount usage:', discErr)
                }
            }
            // Notify Admin
            try {
                const { notifyAdminOfSale } = await import('@/utils/notifications')
                await notifyAdminOfSale({
                    eventName: event?.title,
                    customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                    amount: (ticketTier.price * quantity),
                    currency: tx.currency || 'GHS',
                    quantity: quantity,
                    ticketType: ticketTier?.name || 'Ticket'
                })
            } catch (ignore) { }

            // Notify Organizer (if they have notifications enabled)
            try {
                const organizer = event?.organizers
                // Fallback to main email if notification_email is not set
                const targetEmail = organizer?.notification_email || organizer?.email

                if (organizer?.notify_on_sale && targetEmail) {
                    const { notifyOrganizerOfSale } = await import('@/utils/notifications')
                    await notifyOrganizerOfSale({
                        organizerEmail: targetEmail,
                        organizerName: organizer.name || 'Organizer',
                        eventName: event?.title,
                        customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                        amount: (ticketTier.price * quantity),
                        currency: tx.currency || 'GHS',
                        quantity: quantity,
                        ticketType: ticketTier?.name || 'Ticket',
                        eventUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'}/dashboard/events/${event.id}`
                    })
                }
            } catch (ignore) { }
        }

        allTickets.push(...ticketsToProcess)

        // Collect tickets for this tier (for consolidated email)
        if (ticketsToProcess.length > 0) {
            ticketGroupsForEmail.push({
                tierName: ticketTier?.name || 'Ticket',
                tickets: ticketsToProcess.map((t) => ({
                    id: t.id,
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${t.qr_code_hash}`
                }))
            })
        }
    }

    // 6. Send ONE Consolidated Email (After Loop)
    if (anyTicketsCreated && targetEmail && emailPrimaryEvent) {
        try {
            const { sendTicketEmail } = await import('@/utils/email')

            await sendTicketEmail({
                to: targetEmail,
                eventName: emailPrimaryEvent?.title,
                eventDate: new Date(emailPrimaryEvent?.starts_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric'
                }),
                venueName: emailPrimaryEvent?.venue_name,
                customerName,
                posterUrl: primaryPosterUrl || undefined,
                // Use ticketGroups for multi-tier orders, tickets for single-tier
                ticketGroups: ticketGroupsForEmail.length > 1 ? ticketGroupsForEmail : undefined,
                tickets: ticketGroupsForEmail.length === 1
                    ? ticketGroupsForEmail[0].tickets.map(t => ({ ...t, type: ticketGroupsForEmail[0].tierName }))
                    : undefined,
                ticketType: ticketGroupsForEmail.length === 1 ? ticketGroupsForEmail[0].tierName : undefined,
                reservationId: reservations[0]?.id
            })
        } catch (e) {
            console.error('Consolidated Email error:', e)
        }
    }

    // 7. Update Marketing Stats (UTM Tracking)
    try {
        for (const reservation of reservations) {
            const metadata = reservation.metadata
            if (metadata && metadata.utm_source) {
                const { utm_source, utm_medium, utm_campaign } = metadata
                const amount = reservation._calc.ticketTier.price * reservation.quantity
                const currency = reservation._calc.ticketTier.currency || 'GHS'

                console.log(`[Marketing] Updating stats for Source: ${utm_source}, Amount: ${amount}`)

                // Update marketing_stats table
                await supabase.rpc('track_marketing_conversion', {
                    p_event_id: reservation.event_id,
                    p_utm_source: utm_source,
                    p_utm_medium: utm_medium,
                    p_utm_campaign: utm_campaign,
                    p_revenue: amount,
                    p_currency: currency
                })
            }
        }
    } catch (err) {
        console.error('Marketing Stats Update Error:', err)
    }

    return { success: true, tickets: allTickets }
}

// Keep helper functions if needed (none removed)
