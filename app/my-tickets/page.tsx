import { createClient } from '@/utils/supabase/server'
import { MyTicketsClient } from '@/components/ticket/MyTicketsClient'
import { LandingHeader } from '@/components/LandingHeader'
import { redirect } from 'next/navigation'
import { Ticket } from '@/types/gatepass'

export const metadata = {
    title: 'My Tickets | GatePass',
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
                id, title, poster_url, starts_at, venue_name, primary_color
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
            status,
            next_instalment_due_at,
            created_at,
            reservations!inner (
                user_id,
                quantity,
                ticket_tiers ( id, name, price, currency ),
                events ( id, title, poster_url, starts_at, venue_name, primary_color )
            )
        `)
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching instalments:", error)
    }

    return (
        <div className="relative min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-50 pb-20 overflow-hidden font-sans">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-50/50 via-white to-white dark:from-zinc-900/30 dark:via-black dark:to-black pointer-events-none z-0" />

            <LandingHeader showAccountMenu={true} />

            <main className="relative z-10 max-w-4xl mx-auto px-5 pt-32 md:pt-40 animate-fade-in">
                <div className="mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-zinc-900 dark:text-white">
                        My Tickets
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm md:text-base">
                        Manage your upcoming events, instalments, and transfers
                    </p>
                </div>

                <MyTicketsClient tickets={tickets as unknown as Ticket[]} instalments={instalments as any[]} />
            </main>
        </div>
    )
}
