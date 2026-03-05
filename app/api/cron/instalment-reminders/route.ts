import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendInstalmentReminderEmail } from '@/utils/email-instalment'

/**
 * GET /api/cron/instalment-reminders
 * 
 * Runs on a schedule (e.g., daily) to:
 * 1. Send reminders for instalments due within 48 hours
 * 2. Mark overdue instalments and send overdue notices
 * 3. Forfeit reservations past the grace period
 * 
 * Set up a Vercel Cron or external cron to call this endpoint daily.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    let remindersSent = 0
    let overdueMarked = 0
    let forfeited = 0

    try {
        // ==========================================
        // 1. SEND REMINDERS (Due within 48 hours)
        // ==========================================
        const { data: upcomingPayments } = await supabase
            .schema('gatepass')
            .from('instalment_payments')
            .select(`
                *,
                instalment_reservations(
                    *,
                    payment_plans(*),
                    reservations(
                        *,
                        events(id, title)
                    )
                )
            `)
            .eq('status', 'pending')
            .lte('due_at', in48Hours.toISOString())
            .gte('due_at', now.toISOString())

        if (upcomingPayments) {
            for (const payment of upcomingPayments) {
                const ir = payment.instalment_reservations
                if (!ir || ir.status !== 'active') continue

                const event = ir.reservations?.events
                const plan = ir.payment_plans
                const totalPayments = plan?.num_instalments || 0

                try {
                    await sendInstalmentReminderEmail({
                        to: ir.contact_email,
                        customerName: ir.contact_name || 'Guest',
                        eventName: event?.title || 'Event',
                        amount: payment.amount,
                        currency: payment.currency || ir.currency || 'GHS',
                        dueAt: payment.due_at,
                        instalmentNumber: payment.instalment_number,
                        totalInstalments: totalPayments,
                        instalmentReservationId: ir.id
                    })
                    remindersSent++
                } catch (e) {
                    console.error(`Reminder email failed for payment ${payment.id}:`, e)
                }
            }
        }

        // ==========================================
        // 2. MARK OVERDUE PAYMENTS
        // ==========================================
        const { data: overduePayments } = await supabase
            .schema('gatepass')
            .from('instalment_payments')
            .select(`
                *,
                instalment_reservations(
                    *,
                    payment_plans(*),
                    reservations(events(id, title))
                )
            `)
            .eq('status', 'pending')
            .lt('due_at', now.toISOString())

        if (overduePayments) {
            for (const payment of overduePayments) {
                // Mark as overdue
                await supabase
                    .schema('gatepass')
                    .from('instalment_payments')
                    .update({ status: 'overdue' })
                    .eq('id', payment.id)

                overdueMarked++

                // Send overdue notice
                const ir = payment.instalment_reservations
                if (!ir || ir.status !== 'active') continue

                const event = ir.reservations?.events
                const plan = ir.payment_plans

                try {
                    await sendInstalmentReminderEmail({
                        to: ir.contact_email,
                        customerName: ir.contact_name || 'Guest',
                        eventName: event?.title || 'Event',
                        amount: payment.amount,
                        currency: payment.currency || ir.currency || 'GHS',
                        dueAt: payment.due_at,
                        instalmentNumber: payment.instalment_number,
                        totalInstalments: plan?.num_instalments || 0,
                        instalmentReservationId: ir.id,
                        isOverdue: true
                    })
                } catch (e) {
                    console.error(`Overdue email failed for payment ${payment.id}:`, e)
                }
            }
        }

        // ==========================================
        // 3. FORFEIT EXPIRED RESERVATIONS
        // ==========================================
        // Find active instalment reservations where all overdue payments have 
        // exceeded the grace period
        const { data: activeInstalments } = await supabase
            .schema('gatepass')
            .from('instalment_reservations')
            .select(`
                *,
                payment_plans(*),
                instalment_payments(*),
                reservations(
                    events(
                        title,
                        organizers(email, notification_email, name)
                    )
                )
            `)
            .eq('status', 'active')

        if (activeInstalments) {
            for (const ir of activeInstalments) {
                const plan = ir.payment_plans
                if (!plan?.forfeit_on_miss) continue // Skip if forfeit is not enabled

                const gracePeriodMs = (plan.grace_period_hours || 48) * 60 * 60 * 1000
                const overduePayments = (ir.instalment_payments || [])
                    .filter((p: any) => p.status === 'overdue')

                // Check if any overdue payment is past the grace period
                const hasExpiredOverdue = overduePayments.some((p: any) => {
                    const dueDate = new Date(p.due_at)
                    const graceDeadline = new Date(dueDate.getTime() + gracePeriodMs)
                    return now > graceDeadline
                })

                if (hasExpiredOverdue) {
                    // Forfeit the reservation
                    try {
                        await supabase.rpc('release_instalment_reservation', {
                            p_instalment_reservation_id: ir.id
                        })

                        forfeited++

                        // Send forfeit email
                        const { sendInstalmentForfeitEmail } = await import('@/utils/email-instalment')
                        const eventWrapper = ir.reservations?.events
                        const event = Array.isArray(eventWrapper) ? eventWrapper[0] : eventWrapper
                        const eventTitle = event?.title || 'Event'

                        await sendInstalmentForfeitEmail({
                            to: ir.contact_email,
                            customerName: ir.contact_name || 'Guest',
                            eventName: eventTitle,
                            totalPaid: ir.amount_paid,
                            totalAmount: ir.total_amount,
                            currency: ir.currency || 'GHS'
                        })

                        // Notify organizer to handle potential refunds
                        const organizer = event?.organizers
                        const organizerEmail = organizer?.notification_email || organizer?.email
                        if (organizerEmail && ir.amount_paid > 0) {
                            try {
                                const { sendInstalmentForfeitEmailToOrganizer } = await import('@/utils/email-instalment')
                                await sendInstalmentForfeitEmailToOrganizer({
                                    to: organizerEmail,
                                    organizerName: organizer?.name || 'Organizer',
                                    customerName: ir.contact_name || 'Guest',
                                    customerEmail: ir.contact_email,
                                    eventName: eventTitle,
                                    amountPaid: ir.amount_paid,
                                    currency: ir.currency || 'GHS'
                                })
                            } catch (orgErr) {
                                console.error('Organizer forfeit notification failed:', orgErr)
                            }
                        }
                    } catch (e) {
                        console.error(`Forfeit failed for instalment reservation ${ir.id}:`, e)
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            remindersSent,
            overdueMarked,
            forfeited
        })
    } catch (error: any) {
        console.error('[instalment-reminders] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
