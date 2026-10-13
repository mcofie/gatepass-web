import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { PublicTicketActions } from '@/components/ticket/PublicTicketActions'
import { TicketPass } from '@/components/ticket/TicketPass'

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ id: string }>
}

export const metadata: Metadata = {
    title: 'Event pass',
    description: 'View your GatePass event pass.',
    robots: { index: false, follow: false },
}

export default async function PublicTicketPage({ params }: Props) {
    const { id } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Missing Supabase configuration for ticket page')
        return <div className="p-10 text-center">This pass is temporarily unavailable.</div>
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: ticket, error } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select(`
            *,
            events (*),
            ticket_tiers (*),
            profiles:user_id (full_name)
        `)
        .eq('id', id)
        .single()

    if (error || !ticket || !ticket.events || !ticket.ticket_tiers) notFound()

    const event = ticket.events
    const tier = ticket.ticket_tiers
    let guestName = ticket.profiles?.full_name || 'Guest'
    if (!ticket.profiles?.full_name && ticket.reservation_id) {
        const { data: reservation } = await supabase
            .schema('gatepass')
            .from('reservations')
            .select('guest_name')
            .eq('id', ticket.reservation_id)
            .single()
        if (reservation?.guest_name) guestName = reservation.guest_name
    }

    const eventStart = new Date(event.starts_at).getTime()
    const eventEnd = event.ends_at ? new Date(event.ends_at).getTime() : eventStart + 4 * 60 * 60 * 1000
    const eventEnded = eventEnd < Date.now()
    const pass = {
        id: ticket.id,
        qr_code_hash: ticket.qr_code_hash,
        status: ticket.status,
        reservations: { guest_name: guestName },
    }
    const passProps = {
        event: { ...event, venue_address: event.venue_address || '' },
        ticket: pass,
        tierName: tier.name,
        isVirtual: Boolean(tier.is_virtual),
        eventEnded,
        virtualLink: tier.virtual_link,
        virtualInstructions: tier.virtual_instructions,
    }

    return (
        <div className="min-h-svh bg-[#f7f7f7] text-[#111] dark:bg-[#080808] dark:text-white">
            <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-5 py-6 sm:px-8">
                <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.03em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white">
                    <GatePassMark className="size-6" />GatePass
                </Link>
                <Link href="/my-tickets" className="inline-flex items-center gap-2 rounded-full border border-[#dedede] bg-white px-4 py-2 text-[12px] font-semibold transition-colors hover:border-[#aaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-[#383838] dark:bg-[#111] dark:focus-visible:ring-white">
                    <ArrowLeft className="size-3.5" aria-hidden="true" />My tickets
                </Link>
            </header>

            <main className="mx-auto w-full max-w-[620px] px-4 pb-16 pt-7 sm:px-6 sm:pt-10">
                <div className="mb-6 px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#777] dark:text-[#aaa]">Your pass</p>
                    <h1 className="mt-2 text-[clamp(2.2rem,6vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.06em]">Ticket details</h1>
                    <p className="mt-2 text-[14px] text-[#666] dark:text-[#aaa]">Your pass and event details, in one place.</p>
                </div>

                <TicketPass {...passProps} />

                <div className="mt-5">
                    <PublicTicketActions ticketId={ticket.id} eventTitle={event.title} />
                </div>
            </main>
        </div>
    )
}
