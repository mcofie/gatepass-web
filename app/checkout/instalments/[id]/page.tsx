import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import InstalmentDetailClient from '@/app/my-tickets/instalments/[id]/InstalmentDetailClient'
import { LandingHeader } from '@/components/LandingHeader'

// This is the public-facing guest portal for instalment payments
// Allows users who aren't logged in to access their payment plan via a direct link

export async function generateMetadata({ params }: { params: any }) {
    const { id } = await params
    return {
        title: 'Payment Plan Details – GatePass',
        description: `View details for instalment plan ${id}`
    }
}

export default async function GuestInstalmentDetailPage({ params }: { params: any }) {
    const { id } = await params
    const supabase = await createClient()

    // 1. Fetch Plan Details (Unauthenticated)
    // We allow public access if they have the specific ID
    const { data: instalment, error } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select(`
            *,
            payment_plans(*),
            instalment_payments(*),
            reservations(
                *,
                ticket_tiers(*),
                events(id, title, starts_at, ends_at, poster_url, venue_name, venue_address, organizers(name, slug))
            )
        `)
        .or(`id.eq.${id},reservation_id.eq.${id}`)
        .maybeSingle()

    if (error || !instalment) {
        notFound()
    }

    // Sort payments by instalment number
    if (instalment.instalment_payments) {
        instalment.instalment_payments.sort((a: any, b: any) => a.instalment_number - b.instalment_number)
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-black dark:text-white pb-20">
            <LandingHeader showAccountMenu={false} />
            <main className="max-w-4xl mx-auto px-4 pt-24 sm:pt-32 min-h-screen">
                <InstalmentDetailClient instalment={instalment} />
            </main>
        </div>
    )
}
