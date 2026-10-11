import { createClient } from '@/utils/supabase/server'
import { MyTicketsClient } from '@/components/ticket/MyTicketsClient'
import { LandingHeader } from '@/components/LandingHeader'
import { redirect } from 'next/navigation'
import { Ticket } from '@/types/gatepass'

export const metadata = {
    title: 'My tickets',
}

export default async function MyTicketsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login?next=/my-tickets')
    }


    const { data: tickets } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select(`
            *,
            events (
                id, title, poster_url, starts_at, ends_at, venue_name
            ),
            ticket_tiers (
                id, name, price, currency, is_virtual, virtual_link, virtual_instructions
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    // Also fetch instalment plans
    const { data: instalments, error } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select(`
            id,
            reservation_id,
            total_amount,
            amount_paid,
            currency,
            status,
            next_instalment_due_at,
            created_at,
            reservations!inner (
                user_id,
                quantity,
                ticket_tiers ( id, name, price, currency ),
                events ( id, title, poster_url, starts_at, ends_at, venue_name )
            )
        `)
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching instalments:", error)
    }

    return (
        <div className="min-h-svh bg-white text-[#111] dark:bg-[#080808] dark:text-white">
            <LandingHeader showAccountMenu={true} />

            <main className="mx-auto w-full max-w-[1040px] px-5 pb-20 pt-32 sm:px-8 md:pt-40">
                <div className="mb-9 md:mb-12">
                    <h1 className="text-[clamp(2.75rem,5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.065em]">My tickets</h1>
                    <p className="mt-3 text-[15px] text-[#666] dark:text-[#aaa]">Your passes and payment plans in one place.</p>
                </div>

                <MyTicketsClient tickets={tickets as unknown as Ticket[]} instalments={instalments as any[]} />
            </main>
        </div>
    )
}
