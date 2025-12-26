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
                id, name, price, currency
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return (
        <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white pb-20">
            <LandingHeader showAccountMenu={true} />

            <main className="max-w-4xl mx-auto px-5 pt-32 md:pt-40">
                <div className="mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">My Tickets</h1>
                    <p className="text-gray-500 font-medium text-sm md:text-base">Manage your upcoming events and transfers</p>
                </div>

                <MyTicketsClient tickets={tickets as unknown as Ticket[]} />
            </main>
        </div>
    )
}
