import { createClient } from '@/utils/supabase/server'
import { MyTicketsClient } from '@/components/ticket/MyTicketsClient'
import { LandingHeader } from '@/components/LandingHeader'
import { redirect } from 'next/navigation'
import { Ticket } from '@/types/gatepass'
import Link from 'next/link'
import { getMyAttendeeProfile } from '@/app/actions/attendee-profile'
import { AttendeeProfileForm } from '@/components/ticket/AttendeeProfileForm'

export const metadata = {
    title: 'My tickets',
}

export default async function MyTicketsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const tab = (await searchParams).tab === 'profile' ? 'profile' : 'tickets'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login?next=/my-tickets')
    }

    if (tab === 'profile') {
        const profile = await getMyAttendeeProfile()
        return <Shell tab={tab}>{profile && <AttendeeProfileForm initial={profile} />}</Shell>
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
        <Shell tab={tab}>
            <MyTicketsClient tickets={tickets as unknown as Ticket[]} instalments={instalments as any[]} />
        </Shell>
    )
}

function Shell({ tab, children }: { tab: 'tickets' | 'profile'; children: React.ReactNode }) {
    const tabClass = (active: boolean) => `inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${active ? 'bg-[#111] text-white dark:bg-white dark:text-black' : 'text-[#666] hover:text-black dark:text-[#aaa] dark:hover:text-white'}`
    return (
        <div className="min-h-svh bg-white text-[#111] dark:bg-[#080808] dark:text-white">
            <LandingHeader showAccountMenu={true} />

            <main className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-24 sm:px-8 sm:pt-32 md:pt-40">
                <div className="mb-7 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-[clamp(2.25rem,8vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.06em]">{tab === 'profile' ? 'Your profile' : 'My tickets'}</h1>
                        <p className="mt-2 text-[15px] text-[#666] dark:text-[#aaa] sm:mt-3">
                            {tab === 'profile' ? 'Tell organizers a little about you, so they can plan a better experience.' : 'Your passes and payment plans in one place.'}
                        </p>
                    </div>
                    <nav aria-label="Account" className="inline-flex self-start rounded-full border border-[#e5e5e5] p-1 dark:border-[#303030] sm:self-auto">
                        <Link href="/my-tickets" aria-current={tab === 'tickets' ? 'page' : undefined} className={tabClass(tab === 'tickets')}>Tickets</Link>
                        <Link href="/my-tickets?tab=profile" aria-current={tab === 'profile' ? 'page' : undefined} className={tabClass(tab === 'profile')}>Profile</Link>
                    </nav>
                </div>

                {children}
            </main>
        </div>
    )
}
