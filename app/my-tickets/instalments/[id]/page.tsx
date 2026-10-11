import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import InstalmentDetailClient from './InstalmentDetailClient'
import { LandingHeader } from '@/components/LandingHeader'

export const metadata = {
    title: 'Payment plan',
    description: 'View your GatePass payment plan.',
    robots: { index: false, follow: false },
}

export default async function InstalmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect(`/login?next=/my-tickets/instalments/${id}`)

    const { data: instalment, error } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select(`
            id,
            reservation_id,
            total_amount,
            amount_paid,
            currency,
            status,
            contact_email,
            instalment_payments(id, instalment_number, amount, currency, status, due_at, paid_at),
            reservations(
                guest_email,
                quantity,
                ticket_tiers(name),
                events(id, title, starts_at, ends_at, poster_url, venue_name)
            )
        `)
        .or(`id.eq.${id},reservation_id.eq.${id}`)
        .single()

    if (error || !instalment) notFound()

    const reservation = instalment.reservations?.[0]
    const instalmentDetail = {
        ...instalment,
        reservations: reservation ? {
            ...reservation,
            ticket_tiers: reservation.ticket_tiers?.[0] ?? null,
            events: reservation.events?.[0] ?? null,
        } : null,
    }

    return (
        <div className="min-h-svh bg-white text-[#111] dark:bg-[#080808] dark:text-white">
            <LandingHeader showAccountMenu={true} />
            <main className="mx-auto w-full max-w-[780px] px-5 pb-20 pt-32 sm:px-8 md:pt-40">
                <InstalmentDetailClient instalment={instalmentDetail} />
            </main>
        </div>
    )
}
