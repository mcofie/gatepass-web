import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { CheckoutClient } from '@/components/CheckoutClient'
import { getFeeSettings } from '@/utils/settings'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Checkout',
}

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ reservationId: string }>
}

export default async function CheckoutPage({ params }: PageProps) {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { reservationId } = await params

    // Use Admin Client to bypass RLS for checkout retrieval (Capability URL pattern)
    const { data: reservation } = await adminSupabase
        .schema('gatepass')
        .from('reservations')
        .select('*, ticket_tiers(*), events(*)')
        .eq('id', reservationId)
        .single()

    // Fetch Addons using Admin to ensure visibility
    const { data: addons, error: addonsError } = await adminSupabase
        .schema('gatepass')
        .from('event_addons')
        .select('*')
        .eq('event_id', reservation?.event_id)
        .eq('is_active', true)
        .order('price', { ascending: true })

    if (addonsError) {
        console.error('[CheckoutPage] Addons Fetch Error:', addonsError)
    }

    console.log(`[CheckoutPage] Reservation: ${reservationId}, Event: ${reservation?.event_id}`)
    console.log(`[CheckoutPage] Addons Found: ${addons?.length}`, addons)

    let discount = null
    if (reservation?.discount_id) {
        const { data: d } = await supabase.schema('gatepass').from('discounts').select('*').eq('id', reservation.discount_id).single()
        discount = d
    }

    const feeSettings = await getFeeSettings()

    if (!reservation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p>Loading reservation...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-white selection:bg-amber-500/30 selection:text-amber-200">
            <CheckoutClient
                reservation={reservation}
                feeRates={feeSettings}
                discount={discount}
                availableAddons={addons || []}
            />
        </div>
    )
}
