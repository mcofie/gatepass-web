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
    // Check if tickets already exist for this reference
    const { data: existingTickets } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('*')
        .eq('order_reference', reference)

    if (existingTickets && existingTickets.length > 0) {
        // Tickets already exist, return them
        return { success: true, tickets: existingTickets, message: 'Tickets already exist' }
    }

    // Generate Tickets Loop
    const quantity = reservation.quantity || 1
    console.log(`Generating ${quantity} tickets for Reservation ${reservation.id}`)
    const createdTickets = []
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
                order_reference: reference, // Same reference for all, or append index? Same ref is fine to link to order.
                status: 'valid',
                // metadata: { index: i + 1, total: quantity } // Removed until migration is applied
            })
            .select()
            .single()

        if (ticketError) {
            console.error(`Ticket Creation Error (Index ${i}):`, JSON.stringify(ticketError, null, 2))
            lastError = ticketError
            // Continue or fail? If one fails, it's messy. For MVP, we log and continue, or break.
            // Ideally transactional, but simple loop for now.
        } else if (ticket) {
            // Attach reservation data so frontend can show guest_name/profiles immediately
            createdTickets.push({ ...ticket, reservations: reservation })
        }
    }

    if (createdTickets.length === 0) {
        return { success: false, error: `Failed to generate any tickets. DB Error: ${JSON.stringify(lastError?.message || lastError)}` }
    }

    // 5. Update Reservation Status
    await supabase.schema('gatepass').from('reservations').update({ status: 'confirmed' }).eq('id', reservation.id)

    // 5b. Inventory Update: Increment quantity_sold (Atomic RPC)
    const { error: rpcError } = await supabase.rpc('increment_quantity_sold', {
        p_tier_id: reservation.ticket_tiers.id,
        p_quantity: reservation.quantity || 1
    })

    if (rpcError) {
        console.error('Inventory Update Error (RPC):', rpcError)
        // Non-blocking: We don't fail the request if inventory count is slightly off, but we log it.
    }


    // 6. Send Email
    try {
        const resendApiKey = process.env.RESEND_API_KEY
        if (resendApiKey) {
            const { Resend } = await import('resend')
            const { TicketEmail } = await import('@/emails/TicketEmail')
            const resend = new Resend(resendApiKey)

            const targetEmail = reservation.profiles?.email || reservation.guest_email
            if (!targetEmail) {
                console.warn('Email Warning: No profile or guest email found for reservation:', reservation.id)
            } else {
                console.log('Sending ticket email to:', targetEmail)
            }

            const emailResponse = await resend.emails.send({
                from: 'GatePass <onboarding@resend.dev>',
                to: targetEmail || 'delivered@resend.dev',
                subject: `Your Ticket for ${reservation.events?.title || 'Event'}`,
                react: TicketEmail({
                    eventName: reservation.events?.title,
                    eventDate: new Date(reservation.events?.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }),
                    venueName: reservation.events?.venue_name,
                    ticketType: reservation.ticket_tiers?.name,
                    customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${createdTickets[0].qr_code_hash}`,
                    ticketId: createdTickets[0].id.substring(0, 8).toUpperCase()
                })
            })

            if (emailResponse.error) {
                console.error('Resend API Returned Error:', emailResponse.error)
            } else {
                console.log('Email successfully sent. ID:', emailResponse.data?.id)
            }
        } else {
            console.warn('RESEND_API_KEY missing. Skipped email.')
        }
    } catch (emailError: any) {
        console.error('Email Send Exception:', emailError)
        // Check for specific Resend error (e.g. Free tier)
        if (emailError?.message?.includes('only send to yourself')) {
            console.error('RESEND LIMITATION: You are on the free tier. You can ONLY send emails to the address you signed up with.')
        }
        // Proceed since ticket is created
    }

    return { success: true, tickets: createdTickets }
}
