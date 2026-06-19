import React from 'react'
import { createAdminClient } from '@/utils/supabase/admin'
import { SuccessClient } from './SuccessClient'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ reservationId: string }>
}

export default async function CheckoutSuccessPage({ params }: PageProps) {
    const { reservationId } = await params
    const adminSupabase = createAdminClient()

    // 1. Fetch Reservation
    const { data: reservation } = await adminSupabase
        .schema('gatepass')
        .from('reservations')
        .select('*, events(*)')
        .eq('id', reservationId)
        .single()

    if (!reservation) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-sm text-zinc-500">Order not found.</p>
            </div>
        )
    }

    // 2. Fetch Tickets
    const { data: tickets } = await adminSupabase
        .schema('gatepass')
        .from('tickets')
        .select('*, ticket_tiers(*)')
        .eq('reservation_id', reservationId)

    // 3. Fetch Custom questions
    const { data: questions } = await adminSupabase
        .schema('gatepass')
        .from('event_form_questions')
        .select('*')
        .eq('event_id', reservation.event_id)
        .order('sort_order', { ascending: true })

    return (
        <SuccessClient 
            reservation={reservation} 
            tickets={tickets || []} 
            questions={questions || []} 
        />
    )
}
