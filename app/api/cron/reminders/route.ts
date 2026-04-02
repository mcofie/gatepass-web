import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { sendManualSMS } from '@/app/actions/communications'
import { notifyDiscord } from '@/utils/discord'

export const dynamic = 'force-dynamic'

/**
 * Automates installment payment reminders via SMS.
 * Designed to be called by a cron service (e.g., Vercel Cron, Upstash).
 * Reminds customers a day before and on the day of their installment deadline.
 */
export async function GET(request: Request) {
    // 1. Authorization Check (Simple Secret Implementation)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const now = new Date()
    
    // Define Time Windows
    const dayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

    let sentReminders = 0
    let errors: string[] = []

    try {
        // --- QUEUE 1: DAY BEFORE REMINDERS ---
        // Find pending payments due within the next 24 to 28 hours (to avoid overlap if run hourly)
        const { data: upcomingPayments, error: upcomingError } = await supabase
            .schema('gatepass')
            .from('instalment_payments')
            .select(`
                id,
                amount,
                due_at,
                instalment_reservation_id,
                instalment_reservations!inner (
                    id,
                    short_code,
                    contact_phone,
                    contact_name,
                    payment_plan_id,
                    payment_plans!inner (
                        event_id,
                        events!inner (
                            title,
                            organization_id
                        )
                    )
                )
            `)
            .eq('status', 'pending')
            .eq('reminder_day_before_sent', false)
            .gte('due_at', now.toISOString())
            .lte('due_at', dayFromNow.toISOString())

        if (upcomingError) throw upcomingError

        for (const payment of (upcomingPayments || [])) {
            const res = payment.instalment_reservations as any
            const event = res.payment_plans.events
            const phone = res.contact_phone
            const name = res.contact_name || 'Guest'
            const amount = payment.amount
            const dateStr = new Date(payment.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const code = res.short_code || res.id.substring(0, 8)
            const portalUrl = `https://gatepass.so/i/${code}`

            const message = `GatePass: Hi ${name}, just a heads up that your installment of GHS ${amount} for "${event.title}" is due tomorrow, ${dateStr}. Pay here: ${portalUrl}`

            const { success } = await sendManualSMS({
                to: phone,
                message,
                organizationId: event.organization_id
            })

            if (success) {
                await supabase
                    .schema('gatepass')
                    .from('instalment_payments')
                    .update({ reminder_day_before_sent: true })
                    .eq('id', payment.id)
                sentReminders++
            }
        }

        // --- QUEUE 2: DUE DAY REMINDERS ---
        // Find pending payments due TODAY (within the next 4 hours)
        const { data: dueTodayPayments, error: todayError } = await supabase
            .schema('gatepass')
            .from('instalment_payments')
            .select(`
                id,
                amount,
                due_at,
                instalment_reservation_id,
                instalment_reservations!inner (
                    id,
                    short_code,
                    contact_phone,
                    contact_name,
                    payment_plan_id,
                    payment_plans!inner (
                        event_id,
                        events!inner (
                            title,
                            slug,
                            organization_id
                        )
                    )
                )
            `)
            .eq('status', 'pending')
            .eq('reminder_due_day_sent', false)
            .gte('due_at', now.toISOString())
            .lte('due_at', twoHoursFromNow.toISOString())

        if (todayError) throw todayError

        for (const payment of (dueTodayPayments || [])) {
            const res = payment.instalment_reservations as any
            const event = res.payment_plans.events
            const phone = res.contact_phone
            const name = res.contact_name || 'Guest'
            const amount = payment.amount
            const code = res.short_code || res.id.substring(0, 8)
            const portalUrl = `https://gatepass.so/i/${code}`

            const message = `GatePass Alert: Hi ${name}, your installment payment of GHS ${amount} for "${event.title}" is due TODAY. Pay here: ${portalUrl}`

            const { success } = await sendManualSMS({
                to: phone,
                message,
                organizationId: event.organization_id
            })

            if (success) {
                await supabase
                    .schema('gatepass')
                    .from('instalment_payments')
                    .update({ reminder_due_day_sent: true })
                    .eq('id', payment.id)
                sentReminders++
            }
        }

        // Notify Discord of progress
        if (sentReminders > 0) {
            await notifyDiscord(
                `🤖 **Instalment Reminders Dispatched**\n` +
                `Successfully sent **${sentReminders}** SMS reminders to customers today.`,
                'info'
            )
        }

        return NextResponse.json({ 
            success: true, 
            remindersSent: sentReminders,
            timestamp: now.toISOString()
        })

    } catch (err: any) {
        await notifyDiscord(`🔥 **CRITICAL CRON ERROR (Reminders)**\nError: ${err.message}`, 'warning')
        console.error('Cron Exception:', err.message)
        return NextResponse.json({ 
            success: false, 
            error: err.message,
            remindersSent: sentReminders
        }, { status: 500 })
    }
}
