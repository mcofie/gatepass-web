import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { calculateFees, getEffectiveFeeRates } from '@/utils/fees'
import { getFeeSettings } from '@/utils/settings'
import { randomBytes } from 'crypto'
import { InstalmentReservation, InstalmentPayment, Ticket } from '@/types/gatepass'

// ============================================================
// INSTALMENT PAYMENT PROCESSING
// Handles creating instalment plans and processing individual
// instalment payments. Tickets are only created on final payment.
// ============================================================

function getAdminClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
}

export type InstalmentResult = {
    success: boolean
    instalmentReservation?: InstalmentReservation
    tickets?: Ticket[]
    message?: string
    error?: string
}

/**
 * Creates an instalment reservation after the first payment is confirmed.
 * - Increments ticket inventory (reserves the slot)
 * - Creates the instalment_reservation record
 * - Creates all instalment_payment schedule entries
 * - Marks the first payment as paid
 */
export async function createInstalmentReservation(
    reference: string,
    reservationId: string,
    paymentPlanId: string,
    transactionData?: any
): Promise<InstalmentResult> {
    const supabase = getAdminClient()

    // 1. Verify transaction
    let tx = transactionData
    if (!tx) {
        try {
            tx = await verifyPaystackTransaction(reference)
        } catch (e) {
            return { success: false, error: 'Payment verification failed' }
        }
    }

    if (tx.status !== 'success') {
        return { success: false, error: 'Payment was not successful' }
    }

    // 2. Fetch reservation with related data
    const { data: reservation, error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('*, ticket_tiers(*), events(*, organizers(*))')
        .eq('id', reservationId)
        .single()

    if (resError || !reservation) {
        return { success: false, error: 'Reservation not found' }
    }

    // 3. Fetch payment plan
    const { data: plan, error: planError } = await supabase
        .schema('gatepass')
        .from('payment_plans')
        .select('*')
        .eq('id', paymentPlanId)
        .single()

    if (planError || !plan) {
        return { success: false, error: 'Payment plan not found' }
    }

    // 4. Check if an instalment reservation already exists (idempotency)
    const { data: existing } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select('*')
        .eq('reservation_id', reservationId)
        .maybeSingle()

    if (existing) {
        return {
            success: true,
            instalmentReservation: existing as InstalmentReservation,
            message: 'Instalment reservation already exists'
        }
    }

    // 5. Calculate total amount (after discounts)
    const ticketTier = Array.isArray(reservation.ticket_tiers)
        ? reservation.ticket_tiers[0]
        : reservation.ticket_tiers
    const price = ticketTier?.price || 0
    const qty = reservation.quantity || 1
    let totalAmount = price * qty

    // Apply discount if present
    if (reservation.discount_id) {
        const { data: disc } = await supabase
            .schema('gatepass')
            .from('discounts')
            .select('*')
            .eq('id', reservation.discount_id)
            .single()
        if (disc) {
            if (disc.type === 'percentage') {
                totalAmount = totalAmount - (totalAmount * (disc.value / 100))
            } else {
                totalAmount = Math.max(0, totalAmount - disc.value)
            }
        }
    }

    // Apply addons if present
    let addonTotal = 0;
    if (reservation.addons && Object.keys(reservation.addons).length > 0) {
        const addonIds = Object.keys(reservation.addons)
        const { data: addonData } = await supabase
            .schema('gatepass')
            .from('event_addons')
            .select('id, price')
            .in('id', addonIds)

        if (addonData) {
            addonData.forEach(a => {
                const q = reservation.addons[a.id] || 0
                addonTotal += a.price * q
            })
        }
    }
    totalAmount += addonTotal;

    // 6. Calculate instalment schedule
    const initialAmount = Math.round((totalAmount * plan.initial_percent / 100) * 100) / 100
    const remainingAmount = totalAmount - initialAmount
    const remainingInstalments = plan.num_instalments - 1
    const perInstalmentAmount = Math.round((remainingAmount / remainingInstalments) * 100) / 100

    // Build schedule
    const now = new Date()
    const instalmentSchedule: Array<{
        instalment_number: number
        amount: number
        due_at: string
        status: string
    }> = []

    // First instalment (paid now)
    instalmentSchedule.push({
        instalment_number: 1,
        amount: initialAmount,
        due_at: now.toISOString(),
        status: 'paid'
    })

    // Subsequent instalments
    for (let i = 2; i <= plan.num_instalments; i++) {
        const dueDate = new Date(now)
        dueDate.setDate(dueDate.getDate() + (plan.deadline_days * (i - 1)))

        // Last instalment adjusts for rounding
        const amount = i === plan.num_instalments
            ? Math.round((remainingAmount - (perInstalmentAmount * (remainingInstalments - 1))) * 100) / 100
            : perInstalmentAmount

        instalmentSchedule.push({
            instalment_number: i,
            amount,
            due_at: dueDate.toISOString(),
            status: 'pending'
        })
    }

    // 7. Calculate the final deadline for the reservation expiry
    const finalDueDate = new Date(instalmentSchedule[instalmentSchedule.length - 1].due_at)
    finalDueDate.setHours(finalDueDate.getHours() + (plan.grace_period_hours || 48))

    // 8. Create instalment reservation
    const { data: instalmentRes, error: irErr } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .insert({
            reservation_id: reservationId,
            payment_plan_id: paymentPlanId,
            user_id: reservation.user_id,
            total_amount: totalAmount,
            amount_paid: initialAmount,
            currency: ticketTier?.currency || 'GHS',
            status: 'active',
            next_instalment_due_at: instalmentSchedule[1]?.due_at || null,
            contact_email: reservation.guest_email || reservation.profiles?.email,
            contact_name: reservation.guest_name || reservation.profiles?.full_name,
            contact_phone: reservation.guest_phone || reservation.profiles?.phone_number
        })
        .select()
        .single()

    if (irErr || !instalmentRes) {
        console.error('Instalment Reservation Insert Error:', irErr)
        return { success: false, error: 'Failed to create instalment reservation' }
    }

    // 9. Create instalment payment schedule entries
    const paymentEntries = instalmentSchedule.map(s => ({
        instalment_reservation_id: instalmentRes.id,
        instalment_number: s.instalment_number,
        amount: s.amount,
        currency: ticketTier?.currency || 'GHS',
        due_at: s.due_at,
        status: s.status,
        transaction_reference: s.instalment_number === 1 ? reference : null,
        paid_at: s.instalment_number === 1 ? new Date().toISOString() : null
    }))

    const { error: ipErr } = await supabase
        .schema('gatepass')
        .from('instalment_payments')
        .insert(paymentEntries)

    if (ipErr) {
        console.error('Instalment Payments Insert Error:', ipErr)
    }

    // 10. Update reservation status to 'instalment' and extend expiry
    await supabase
        .schema('gatepass')
        .from('reservations')
        .update({
            status: 'instalment',
            expires_at: finalDueDate.toISOString()
        })
        .eq('id', reservationId)

    // 11. Increment ticket inventory (reserve the slot)
    const { error: rpcErr } = await supabase.rpc('increment_ticket_sold', {
        tier_id: ticketTier.id,
        qty: qty
    })

    if (rpcErr) {
        // Fallback
        const { data: t } = await supabase
            .schema('gatepass')
            .from('ticket_tiers')
            .select('quantity_sold')
            .eq('id', ticketTier.id)
            .single()
        if (t) {
            await supabase
                .schema('gatepass')
                .from('ticket_tiers')
                .update({ quantity_sold: (t.quantity_sold || 0) + qty })
                .eq('id', ticketTier.id)
        }
    }

    // 12. Log the initial transaction
    const event = Array.isArray(reservation.events) ? reservation.events[0] : reservation.events
    const globalSettings = await getFeeSettings()
    const effectiveRates = getEffectiveFeeRates(globalSettings, event, event?.organizers)
    const feeBearer = event?.fee_bearer || 'customer'
    const { platformFee, processorFee } = calculateFees(initialAmount, 0, feeBearer, effectiveRates)

    await supabase
        .schema('gatepass')
        .from('transactions')
        .insert({
            reservation_id: reservationId,
            reference,
            amount: tx.amount ? tx.amount / 100 : 0,
            currency: tx.currency,
            channel: tx.channel,
            status: tx.status,
            paid_at: tx.paid_at || tx.paidAt,
            metadata: {
                ...tx,
                instalment_reservation_id: instalmentRes.id,
                instalment_number: 1,
                payment_type: 'instalment'
            },
            platform_fee: platformFee,
            applied_fee_rate: effectiveRates.platformFeePercent,
            applied_processor_fee: processorFee,
            applied_processor_rate: effectiveRates.processorFeePercent
        })

    // 13. Increment discount usage on first payment
    if (reservation.discount_id) {
        try {
            await supabase.rpc('increment_discount_usage', { p_discount_id: reservation.discount_id })
        } catch (e) {
            console.error('Failed to increment discount usage:', e)
        }
    }

    // 14. Send confirmation email with schedule
    try {
        const { sendInstalmentConfirmationEmail } = await import('../email-instalment')
        await sendInstalmentConfirmationEmail({
            to: instalmentRes.contact_email || reservation.guest_email,
            customerName: instalmentRes.contact_name || reservation.guest_name || 'Guest',
            eventName: event?.title,
            eventDate: event?.starts_at,
            tierName: ticketTier?.name,
            quantity: qty,
            totalAmount,
            amountPaid: initialAmount,
            currency: ticketTier?.currency || 'GHS',
            schedule: instalmentSchedule,
            instalmentReservationId: instalmentRes.id
        })
    } catch (e) {
        console.error('Instalment confirmation email error:', e)
    }

    // 15. Notify admin
    try {
        const { notifyAdminOfSale } = await import('@/utils/notifications')
        await notifyAdminOfSale({
            eventName: event?.title,
            customerName: instalmentRes.contact_name || 'Guest',
            amount: initialAmount,
            currency: tx.currency || 'GHS',
            quantity: qty,
            ticketType: `${ticketTier?.name || 'Ticket'} (Instalment 1/${plan.num_instalments})`
        })
    } catch (e) { /* ignore */ }

    return {
        success: true,
        instalmentReservation: instalmentRes as InstalmentReservation,
        message: `Instalment plan started. ${remainingInstalments} payments remaining.`
    }
}

/**
 * Processes a subsequent instalment payment.
 * If this is the final payment, creates the actual tickets.
 */
export async function processInstalmentPayment(
    reference: string,
    instalmentPaymentId: string,
    transactionData?: any
): Promise<InstalmentResult> {
    const supabase = getAdminClient()

    // 1. Verify transaction
    let tx = transactionData
    if (!tx) {
        try {
            tx = await verifyPaystackTransaction(reference)
        } catch (e) {
            return { success: false, error: 'Payment verification failed' }
        }
    }

    if (tx.status !== 'success') {
        return { success: false, error: 'Payment was not successful' }
    }

    // 2. Fetch the instalment payment
    const { data: instalmentPayment, error: ipErr } = await supabase
        .schema('gatepass')
        .from('instalment_payments')
        .select('*, instalment_reservations(*, reservations(*, ticket_tiers(*), events(*, organizers(*))))')
        .eq('id', instalmentPaymentId)
        .single()

    if (ipErr || !instalmentPayment) {
        return { success: false, error: 'Instalment payment not found' }
    }

    // Idempotency: Already paid?
    if (instalmentPayment.status === 'paid') {
        return { success: true, message: 'Payment already recorded' }
    }

    const instalmentRes = instalmentPayment.instalment_reservations
    if (!instalmentRes || instalmentRes.status !== 'active') {
        return { success: false, error: 'Instalment reservation is not active' }
    }

    const reservation = instalmentRes.reservations
    const ticketTier = Array.isArray(reservation?.ticket_tiers)
        ? reservation.ticket_tiers[0]
        : reservation?.ticket_tiers

    // 3. Mark this payment as paid
    await supabase
        .schema('gatepass')
        .from('instalment_payments')
        .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            transaction_reference: reference
        })
        .eq('id', instalmentPaymentId)

    // 4. Update running total
    const newAmountPaid = (instalmentRes.amount_paid || 0) + instalmentPayment.amount

    // 5. Find next pending instalment
    const { data: pendingPayments } = await supabase
        .schema('gatepass')
        .from('instalment_payments')
        .select('*')
        .eq('instalment_reservation_id', instalmentRes.id)
        .eq('status', 'pending')
        .order('instalment_number', { ascending: true })

    const nextPending = pendingPayments?.[0] || null

    // 6. Update instalment reservation
    const updatePayload: any = {
        amount_paid: newAmountPaid,
        next_instalment_due_at: nextPending?.due_at || null,
        updated_at: new Date().toISOString()
    }

    // Check if fully paid
    const isCompleted = newAmountPaid >= instalmentRes.total_amount || !nextPending

    if (isCompleted) {
        updatePayload.status = 'completed'
        updatePayload.completed_at = new Date().toISOString()
        updatePayload.next_instalment_due_at = null
    }

    await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .update(updatePayload)
        .eq('id', instalmentRes.id)

    // 7. Log the transaction
    const event = Array.isArray(reservation?.events) ? reservation.events[0] : reservation?.events
    const globalSettings = await getFeeSettings()
    const effectiveRates = getEffectiveFeeRates(globalSettings, event, event?.organizers)
    const feeBearer = event?.fee_bearer || 'customer'
    const { platformFee, processorFee } = calculateFees(
        instalmentPayment.amount, 0, feeBearer, effectiveRates
    )

    await supabase
        .schema('gatepass')
        .from('transactions')
        .insert({
            reservation_id: reservation?.id,
            reference,
            amount: tx.amount ? tx.amount / 100 : 0,
            currency: tx.currency,
            channel: tx.channel,
            status: tx.status,
            paid_at: tx.paid_at || tx.paidAt,
            metadata: {
                ...tx,
                instalment_reservation_id: instalmentRes.id,
                instalment_number: instalmentPayment.instalment_number,
                payment_type: 'instalment'
            },
            platform_fee: platformFee,
            applied_fee_rate: effectiveRates.platformFeePercent,
            applied_processor_fee: processorFee,
            applied_processor_rate: effectiveRates.processorFeePercent
        })

    // 8. Update instalment payment fees
    await supabase
        .schema('gatepass')
        .from('instalment_payments')
        .update({ platform_fee: platformFee, processor_fee: processorFee })
        .eq('id', instalmentPaymentId)

    // 9. If completed, create tickets!
    if (isCompleted) {
        return await finalizeInstalmentTickets(instalmentRes.id, reservation, ticketTier, event, reference)
    }

    // 10. Send instalment received email
    try {
        const { sendInstalmentReceivedEmail } = await import('../email-instalment')
        await sendInstalmentReceivedEmail({
            to: instalmentRes.contact_email,
            customerName: instalmentRes.contact_name || 'Guest',
            eventName: event?.title,
            tierName: ticketTier?.name,
            instalmentNumber: instalmentPayment.instalment_number,
            totalInstalments: (await supabase
                .schema('gatepass')
                .from('instalment_payments')
                .select('id', { count: 'exact' })
                .eq('instalment_reservation_id', instalmentRes.id)).count || 0,
            amountPaid: instalmentPayment.amount,
            totalPaid: newAmountPaid,
            totalAmount: instalmentRes.total_amount,
            remaining: instalmentRes.total_amount - newAmountPaid,
            currency: instalmentRes.currency || 'GHS',
            nextDueAt: nextPending?.due_at,
            nextAmount: nextPending?.amount,
            instalmentReservationId: instalmentRes.id
        })
    } catch (e) {
        console.error('Instalment received email error:', e)
    }

    return {
        success: true,
        message: `Instalment ${instalmentPayment.instalment_number} received. ${nextPending ? `Next payment due ${new Date(nextPending.due_at).toLocaleDateString()}` : 'All payments complete!'}`,
        instalmentReservation: { ...instalmentRes, amount_paid: newAmountPaid } as InstalmentReservation
    }
}

/**
 * Creates the actual tickets once all instalments are paid.
 * Reuses pattern from processSuccessfulPayment.
 */
async function finalizeInstalmentTickets(
    instalmentReservationId: string,
    reservation: any,
    ticketTier: any,
    event: any,
    lastReference: string
): Promise<InstalmentResult> {
    const supabase = getAdminClient()
    const quantity = reservation.quantity || 1
    const allTickets: Ticket[] = []

    // Create tickets
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
                order_reference: `INST-${lastReference.slice(0, 8)}-${i + 1}`,
                status: 'valid'
            })
            .select()
            .single()

        if (ticket) allTickets.push(ticket as Ticket)
        else if (tErr) console.error('Ticket Insert Error:', tErr)
    }

    // Update reservation to confirmed
    await supabase
        .schema('gatepass')
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservation.id)

    // Note: Inventory was already incremented on first instalment, no need to do it again

    // Send ticket email
    try {
        const { sendTicketEmail } = await import('@/utils/email')
        const targetEmail = reservation.profiles?.email || reservation.guest_email

        let posterUrl = event?.poster_url
        if (posterUrl && !posterUrl.startsWith('http')) {
            const { data: { publicUrl } } = supabase.storage.from('posters').getPublicUrl(posterUrl)
            posterUrl = publicUrl
        }

        if (targetEmail && allTickets.length > 0) {
            await sendTicketEmail({
                to: targetEmail,
                eventName: event?.title,
                eventDate: new Date(event?.starts_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: 'numeric'
                }),
                venueName: event?.venue_name,
                customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                posterUrl: posterUrl || undefined,
                tickets: allTickets.map(t => ({
                    id: t.id,
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${t.qr_code_hash}`,
                    type: ticketTier?.name || 'Ticket'
                })),
                ticketType: ticketTier?.name,
                reservationId: reservation.id
            })
        }
    } catch (e) {
        console.error('Ticket email error (instalment):', e)
    }

    // Notify organizer
    try {
        const organizer = event?.organizers
        const orgEmail = organizer?.notification_email || organizer?.email
        if (organizer?.notify_on_sale && orgEmail) {
            const { notifyOrganizerOfSale } = await import('@/utils/notifications')
            await notifyOrganizerOfSale({
                organizerEmail: orgEmail,
                organizerName: organizer.name || 'Organizer',
                eventName: event?.title,
                customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
                amount: ticketTier.price * quantity,
                currency: ticketTier.currency || 'GHS',
                quantity,
                ticketType: `${ticketTier?.name || 'Ticket'} (Instalment Complete)`,
                eventUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'}/dashboard/events/${event.id}`
            })
        }
    } catch (e) { /* ignore */ }

    return {
        success: true,
        tickets: allTickets,
        message: 'All instalments paid! Your tickets have been issued.'
    }
}

/**
 * Fetches instalment reservations for a user
 */
export async function getUserInstalmentReservations(userId: string) {
    const supabase = getAdminClient()

    const { data, error } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select(`
            *,
            payment_plans(*),
            instalment_payments(*),
            reservations(
                *,
                ticket_tiers(*),
                events(*, organizers(*))
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Fetch instalment reservations error:', error)
        return []
    }

    return data || []
}

/**
 * Get a single instalment reservation by ID (for detail page)
 */
export async function getInstalmentReservation(instalmentReservationId: string) {
    const supabase = getAdminClient()

    const { data, error } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select(`
            *,
            payment_plans(*),
            instalment_payments(*),
            reservations(
                *,
                ticket_tiers(*),
                events(*, organizers(*))
            )
        `)
        .eq('id', instalmentReservationId)
        .single()

    if (error) {
        console.error('Fetch instalment reservation error:', error)
        return null
    }

    return data
}
