import { redirect } from 'next/navigation'
import { confirmPlatformFeePayment, isPlatformFeeReference } from '@/lib/billing'

export const dynamic = 'force-dynamic'

/** Paystack returns here after an organizer pays an event's platform fee. */
export default async function PlatformFeeCallbackPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
    const { reference } = await searchParams
    if (!reference || !isPlatformFeeReference(reference)) redirect('/dashboard/events')

    let destination = '/dashboard/events'
    try {
        const result = await confirmPlatformFeePayment(reference)
        destination = `/dashboard/events/${result.eventId}?billing=${result.status}`
    } catch (error) {
        console.error('[billing/callback]', error)
    }
    redirect(destination)
}
