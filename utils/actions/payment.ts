import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'

export type PaymentResult = {
    success: boolean
    tickets?: any[]
    message?: string
    error?: string
}

export async function processSuccessfulPayment(reference: string, reservationId?: string, transactionData?: any): Promise<PaymentResult> {
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




    // 2. Fetch Reservation details
    const lookupId = reservationId || reference

    const { data: reservation, error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('*, ticket_tiers(*), events(*), profiles:user_id(*)')
        .eq('id', lookupId)
        .single()

    if (resError || !reservation) {
        console.error('Reservation Fetch Error:', resError)
        return { success: false, error: `Reservation not found: ${lookupId}` }
    }

    // 3. Log Transaction (Create History)
    // We do this before ticket creation so we have a record of the payment attempt
    const { error: txError } = await supabase.schema('gatepass').from('transactions').insert({
        reservation_id: reservation.id,
        reference,
        amount: tx.amount ? tx.amount / 100 : 0,
        currency: tx.currency,
        channel: tx.channel,
        status: tx.status,
        paid_at: tx.paid_at || tx.paidAt,
        metadata: tx,
    })

    if (txError) {
        console.error('Transaction Log Error:', txError)
        // We log but maybe don't loop if it's just a duplicate log error, though earlier check should handle it.
        // Proceeding to create ticket because the USER PAID.
    }

    // 4. Idempotency & Creation Logic
    let ticketsToProcess: any[] = []

    // Check if tickets already exist for this reference
    const { data: existingTickets } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('*')
        .eq('order_reference', reference)

    if (existingTickets && existingTickets.length > 0) {
        console.log('Tickets already exist for reference:', reference)
        ticketsToProcess = existingTickets
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
                    tier_id: reservation.ticket_tiers.id,
                    reservation_id: reservation.id,
                    qr_code_hash: Math.random().toString(36).substring(7) + Math.random().toString(36).substring(7), // Longer unique hash
                    order_reference: reference,
                    status: 'valid'
                })
                .select()
                .single()

            if (ticketError) {
                console.error(`Ticket Creation Error (Index ${i}):`, JSON.stringify(ticketError, null, 2))
                lastError = ticketError
            } else if (ticket) {
                // Attach reservation data so frontend can show guest_name/profiles immediately
                ticketsToProcess.push({ ...ticket, reservations: reservation })
            }
        }

        if (ticketsToProcess.length === 0) {
            return { success: false, error: `Failed to generate any tickets. DB Error: ${JSON.stringify(lastError?.message || lastError)}` }
        }

        // 5. Update Reservation Status
        await supabase.schema('gatepass').from('reservations').update({ status: 'confirmed' }).eq('id', reservation.id)

        // 5b. Inventory Update: Increment quantity_sold
        const { data: currentTier } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .select('quantity_sold')
            .eq('id', reservation.ticket_tiers.id)
            .single()

        if (currentTier) {
            const { error: updateError } = await supabase
                .schema('gatepass')
                .from('ticket_tiers')
                .update({ quantity_sold: (currentTier.quantity_sold || 0) + (reservation.quantity || 1) })
                .eq('id', reservation.ticket_tiers.id)

            if (updateError) {
                console.error('Inventory Update Error (Direct):', updateError)
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
    }

    // 6. Send Email
    try {
        const { sendTicketEmail } = await import('@/utils/email')

        const targetEmail = reservation.profiles?.email || reservation.guest_email
        if (!targetEmail) {
            console.warn('Email Warning: No profile or guest email found for reservation:', reservation.id)
        } else {
            console.log('Sending ticket email to:', targetEmail)

            const emailInfo = await sendTicketEmail({
                to: targetEmail,
                eventName: reservation.events?.title,
                eventDate: new Date(reservation.events?.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }),
                venueName: reservation.events?.venue_name,
                ticketType: reservation.ticket_tiers?.name,
                customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                // Keep legacy single props for safety/fallback
                qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticketsToProcess[0].qr_code_hash}`,
                ticketId: ticketsToProcess[0].id,
                posterUrl: reservation.events?.poster_url,
                // Pass consolidated tickets list
                tickets: ticketsToProcess.map((t: any) => ({
                    id: t.id,
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${t.qr_code_hash}`,
                    type: reservation.ticket_tiers?.name || 'Ticket'
                }))
            })

            console.log('Email successfully sent. Message ID:', emailInfo.messageId)
        }
    } catch (emailError: any) {
        console.error('Email Send Exception:', emailError)
        // Proceed since ticket is created
    }

    return { success: true, tickets: ticketsToProcess }
}
