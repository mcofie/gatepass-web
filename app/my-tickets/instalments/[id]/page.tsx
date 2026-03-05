import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import InstalmentDetailClient from './InstalmentDetailClient'
import { LandingHeader } from '@/components/LandingHeader'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return {
        title: 'Payment Plan Details – GatePass',
        description: `View details for instalment plan ${id}`
    }
}

export default async function InstalmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

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
        .single()

    if (error || !instalment) notFound()

    // Sort payments by instalment number
    if (instalment.instalment_payments) {
        instalment.instalment_payments.sort((a: any, b: any) => a.instalment_number - b.instalment_number)
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-black dark:text-white pb-20">
            <LandingHeader showAccountMenu={true} />
            <main className="max-w-4xl mx-auto px-4 pt-28 md:pt-32">
                <InstalmentDetailClient instalment={instalment} />
            </main>
        </div>
    )
}
