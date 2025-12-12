import { createClient } from '@/utils/supabase/server'
import { CheckoutClient } from '@/components/CheckoutClient'

interface PageProps {
    params: Promise<{ reservationId: string }>
}

export default async function CheckoutPage({ params }: PageProps) {
    const supabase = await createClient()
    const { reservationId } = await params

    const { data: reservation } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('*, ticket_tiers(*), events(*)')
        .eq('id', reservationId)
        .single()

    if (!reservation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p>Loading reservation...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-white selection:bg-amber-500/30 selection:text-amber-200">
            <CheckoutClient reservation={reservation} />
        </div>
    )
}
