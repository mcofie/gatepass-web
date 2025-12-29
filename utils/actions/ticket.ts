'use server'

import { createClient } from '@/utils/supabase/server'
import { sendTicketEmail } from '@/utils/email'
import { revalidatePath } from 'next/cache'

export async function resendTicketEmail(reservationId: string) {
    try {
        const supabase = await createClient()

        // 1. Verify Admin (Optional but recommended for this action)
        // For now, assuming this action is used in Admin context which is protected by layout/middleware.
        // But let's check basic auth at least.
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, error: 'Unauthorized' }
        }

        // 2. Fetch Reservation with necessary relations
        const { data: reservation, error: resError } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select(`
                *,
                ticket_tiers ( * ),
                events (
                    *,
                    organizers ( * )
                ),
                profiles ( * )
            `)
            .eq('id', reservationId)
            .single()

        if (resError || !reservation) {
            return { success: false, error: 'Reservation not found' }
        }

        // SECURITY: Verify ownership or admin rights
        const isOwner = reservation.user_id === user.id

        // Check if super admin
        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!isOwner && !profile?.is_super_admin) {
            return { success: false, error: 'Forbidden: You do not own this reservation' }
        }

        // 3. Fetch Tickets
        const { data: tickets, error: ticketError } = await supabase
            .schema('gatepass')
            .from('tickets')
            .select('*')
            .eq('reservation_id', reservationId)

        if (ticketError || !tickets || tickets.length === 0) {
            return { success: false, error: 'No tickets found for this reservation' }
        }

        // 4. Send Email
        const targetEmail = reservation.profiles?.email || reservation.guest_email
        if (!targetEmail) {
            return { success: false, error: 'No email address found for this reservation' }
        }

        const emailInfo = await sendTicketEmail({
            to: targetEmail,
            eventName: reservation.events?.title,
            eventDate: new Date(reservation.events?.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }),
            venueName: reservation.events?.venue_name,
            ticketType: reservation.ticket_tiers?.name,
            customerName: reservation.profiles?.full_name || reservation.guest_name || 'Guest',
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${tickets[0].qr_code_hash}`,
            ticketId: tickets[0].id,
            posterUrl: reservation.events?.poster_url,
            reservationId: reservation.id,
            tickets: tickets.map((t) => ({
                id: t.id,
                qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${t.qr_code_hash}`,
                type: reservation.ticket_tiers?.name || 'Ticket'
            }))
        })

        return { success: true, messageId: emailInfo.messageId }

    } catch (error: any) {
        console.error('Resend Ticket Error:', error)
        return { success: false, error: error.message || 'Failed to send email' }
    }
}
