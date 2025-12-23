import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { Ticket } from '@/types/gatepass'
import { calculateFees, getEffectiveFeeRates } from '@/utils/fees'
import { getFeeSettings } from '@/utils/settings'

export type PaymentResult = {
    success: boolean
    tickets?: Ticket[]
    message?: string
    error?: string
}

export async function processSuccessfulPayment(reference: string, reservationId?: string, transactionData?: any, addons?: Record<string, number>): Promise<PaymentResult> {
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
            // We can decide to abort or proceed. Strict mode: abort.
            return { success: false, error: 'Payment verification failed' }
        }
    }

    if (tx.status !== 'success') {
        return { success: false, error: 'Payment was not successful' }
    }




    // 2. Fetch Reservation details (Step 1: Raw Fetch to avoid Join killing it)
    const lookupId = reservationId || reference

    const { data: rawReservation, error: rawError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('*')
        .eq('id', lookupId)
        .single()

    if (rawError || !rawReservation) {
        console.error('Reservation Fetch Error (Raw):', rawError)
        return { success: false, error: `Reservation not found (Raw): ${lookupId} - ${rawError?.message}` }
    }

    // Step 2: Fetch Relations (Decoupled to prevent single failure from killing process)
    const { data: reservation, error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('*, ticket_tiers(*), events(*)')
        .eq('id', lookupId)
        .single()

    if (resError || !reservation) {
        console.error('Reservation Relation Fetch Error:', resError)
        return { success: false, error: `Reservation relations missing (Events/Tiers): ${lookupId}` }
    }

    // Step 3: Manual Organizer Fetch (Robustness)
    const event = Array.isArray(reservation.events) ? reservation.events[0] : reservation.events
    const ticketTier = Array.isArray(reservation.ticket_tiers) ? reservation.ticket_tiers[0] : reservation.ticket_tiers

    if (event?.organizer_id) {
        const { data: org } = await supabase.schema('gatepass').from('organizers').select('platform_fee_percent').eq('id', event.organizer_id).single()
        if (org) {
            // Attach it back to event object as expected by downstream logic
            event.organizers = org
        }
    }

    // Fetch Profile explicitly (left join equivalent)
    let userProfile = null
    if (reservation.user_id) {
        const { data: p } = await supabase.schema('gatepass').from('profiles').select('*').eq('id', reservation.user_id).single()
        userProfile = p
    }
    // Attach for robust downstream use
    reservation.profiles = userProfile



    const globalSettings = await getFeeSettings()
    const organizer = event?.organizers
    const effectiveRates = getEffectiveFeeRates(globalSettings, event, organizer)

    const rawAmount = tx.amount ? tx.amount / 100 : 0
    const feeBearer = event?.fee_bearer || 'customer'

    // Simplest approach: Use the Reservation Price * Quantity as the subtotal source of truth.
    const price = ticketTier?.price || 0
    const qty = reservation.quantity || 1

    let subtotal = price * qty
    if (reservation.discount_id) {
        const { data: disc } = await supabase.schema('gatepass').from('discounts').select('*').eq('id', reservation.discount_id).single()
        if (disc) {
            if (disc.type === 'percentage') subtotal = subtotal - (subtotal * (disc.value / 100))
            else subtotal = Math.max(0, subtotal - disc.value)
        }
    }

    const { platformFee, processorFee } = calculateFees(subtotal, feeBearer, effectiveRates)

    // 3. Log Transaction (Create History)
    const { error: txError } = await supabase.schema('gatepass').from('transactions').insert({
        reservation_id: reservation.id,
        reference,
        amount: rawAmount,
        currency: tx.currency,
        channel: tx.channel,
        status: tx.status,
        paid_at: tx.paid_at || tx.paidAt,
        metadata: tx,
        platform_fee: platformFee,
        applied_fee_rate: effectiveRates.platformFeePercent,
        applied_processor_fee: processorFee,
        applied_processor_rate: effectiveRates.processorFeePercent
    })

    if (txError) {
        console.error('Transaction Log Error:', txError)
        // We log but maybe don't loop if it's just a duplicate log error, though earlier check should handle it.
        // Proceeding to create ticket because the USER PAID.
    }

    // 4. Idempotency & Creation Logic
    let ticketsToProcess: Ticket[] = []

    // Check if tickets already exist for this reference
    const { data: existingTickets } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('*')
        .eq('order_reference', reference)

    if (existingTickets && existingTickets.length > 0) {
        console.log('Tickets already exist for reference:', reference)
        ticketsToProcess = existingTickets as Ticket[]
    } else {
        // Generate Tickets Loop
        const quantity = reservation.quantity || 1
        console.log(`Generating ${quantity} tickets for Reservation ${reservation.id}`)
        let lastError = null

        for (let i = 0; i < quantity; i++) {
            const { data: ticket, error: ticketError } = await supabase
                .schema('gatepass')
                .from('tickets')
                .insert({
                    user_id: reservation.user_id,
                    event_id: reservation.event_id,
                    tier_id: ticketTier.id,
                    reservation_id: reservation.id,
                    qr_code_hash: Math.random().toString(36).substring(2, 12).toUpperCase(), // Better random hash
                    order_reference: reference,
                    status: 'valid'
                })
                .select()
                .single()

            if (ticketError) {
                console.error(`Ticket Creation Error (Index ${i}):`, JSON.stringify(ticketError, null, 2))
                lastError = ticketError
            } else if (ticket) {
                ticketsToProcess.push({ ...(ticket as Ticket), reservations: reservation })
            }
        }

        if (ticketsToProcess.length === 0) {
            return { success: false, error: `Failed to generate any tickets. DB Error: ${JSON.stringify(lastError?.message || lastError)}` }
        }

        // 5. Update Reservation Status & Add-ons
        await supabase
            .schema('gatepass')
            .from('reservations')
            .update({
                status: 'confirmed',
                addons: addons || null
            })
            .eq('id', reservation.id)

        // 5b. Inventory Update: Increment quantity_sold
        const { data: currentTier } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .select('quantity_sold')
            .eq('id', ticketTier.id)
            .single()

        if (currentTier) {
            const { error: updateError } = await supabase
                .schema('gatepass')
                .from('ticket_tiers')
                .update({ quantity_sold: (currentTier.quantity_sold || 0) + (reservation.quantity || 1) })
                .eq('id', ticketTier.id)

            if (updateError) {
                console.error('Inventory Update Error (Direct):', updateError)
            }
        }

        // 5b-2. Add-ons Inventory Update
        if (addons) {
            for (const [addonId, qty] of Object.entries(addons)) {
                if (qty > 0) {
                    const { data: addonData } = await supabase.schema('gatepass').from('event_addons').select('quantity_sold').eq('id', addonId).single()
                    if (addonData) {
                        await supabase
                            .schema('gatepass')
                            .from('event_addons')
                            .update({ quantity_sold: (addonData.quantity_sold || 0) + Number(qty) })
                            .eq('id', addonId)
                    }
                }
            }
        }


        // 5c. Discount Usage: Increment used_count if applicable
        console.log('Checking Discount for Reservation:', reservation.id, 'Discount ID:', reservation.discount_id)
        if (reservation.discount_id) {
            // Try Atomic RPC First
            const { data: rpcData, error: rpcError } = await supabase.rpc('increment_discount_usage', {
                p_discount_id: reservation.discount_id
            })

            if (!rpcError && rpcData?.success) {
                console.log(`Successfully incremented discount ${reservation.discount_id} usage (Atomic)`)
            } else {
                if (rpcError) console.warn('Atomic Discount Update Failed (RPC missing?):', rpcError.message)

                // Fallback: Read-Modify-Write
                const { data: d } = await supabase.schema('gatepass').from('discounts').select('used_count').eq('id', reservation.discount_id).single()
                if (d) {
                    const newCount = (d.used_count || 0) + 1
                    const { error: discountError } = await supabase.schema('gatepass').from('discounts').update({ used_count: newCount }).eq('id', reservation.discount_id)

                    if (discountError) {
                        console.warn('Discount Update Error (Fallback):', discountError)
                    } else {
                        console.log(`Successfully updated discount ${reservation.discount_id} used_count to ${newCount} (Fallback)`)
                    }
                }
            }
        }

        // 7. Notify Admin of Sale
        try {
            const { notifyAdminOfSale } = await import('@/utils/notifications')
            await notifyAdminOfSale({
                eventName: event?.title,
                customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                amount: rawAmount, // Use transaction amount, not reservation.total_amount
                currency: tx.currency || ticketTier?.currency || 'GHS',
                quantity: reservation.quantity || 1,
                ticketType: ticketTier?.name || 'Ticket'
            })
        } catch (notifyError: any) {
            console.error('Admin Notification Error:', notifyError)
        }
    }

    // 8. Robust Idempotent Email Logic (Always attempt if tickets exist)
    if (ticketsToProcess.length > 0) {
        try {
            const { sendTicketEmail } = await import('@/utils/email')

            const targetEmail = reservation.profiles?.email || reservation.guest_email
            if (!targetEmail) {
                console.warn('[Payment Action] Email Warning: No target email for reservation:', reservation.id)
            } else {
                console.log(`[Payment Action] Attempting email send to: ${targetEmail} for Reservation ${reservation.id}`)

                // Resolve Public URL for Poster
                let posterUrl = event?.poster_url
                if (posterUrl && !posterUrl.startsWith('http')) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('posters')
                        .getPublicUrl(posterUrl)
                    posterUrl = publicUrl
                }

                const emailInfo = await sendTicketEmail({
                    to: targetEmail,
                    eventName: event?.title,
                    eventDate: new Date(event?.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }),
                    venueName: event?.venue_name,
                    ticketType: ticketTier?.name,
                    customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                    reservationId: reservation.id,
                    posterUrl: posterUrl,
                    tickets: ticketsToProcess.map((t) => ({
                        id: t.id,
                        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${t.qr_code_hash}`,
                        type: ticketTier?.name || 'Ticket'
                    }))
                })

                console.log(`[Payment Action] Email Success. messageId: ${emailInfo.messageId}`)
            }
        } catch (emailError: any) {
            console.error('[Payment Action] Email Send Exception:', emailError)
        }
    }

    return { success: true, tickets: ticketsToProcess }
}
