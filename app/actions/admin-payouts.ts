'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

async function requireSuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    const { data: profile } = await supabase.schema('gatepass').from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!profile?.is_super_admin) throw new Error('Forbidden')
    return user
}

/** Records that a held amount was paid out (from the Paystack dashboard). GatePass doesn't move the money. */
export async function markReserveReleased(reference: string, note?: string) {
    await requireSuperAdmin()
    const { data, error } = await createAdminClient().schema('gatepass').from('payment_reserves')
        .update({ status: 'released', released_at: new Date().toISOString(), transfer_code: note?.trim().slice(0, 100) || null, failure_reason: null })
        .eq('reference', reference)
        .in('status', ['held', 'on_hold', 'failed'])
        .select('reference')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error('This hold was already released')
    revalidatePath('/admin/payouts')
}

/** Pauses (or resumes) a hold, e.g. while an event cancellation or dispute is sorted out. */
export async function setReserveOnHold(reference: string, onHold: boolean) {
    await requireSuperAdmin()
    const { error } = await createAdminClient().schema('gatepass').from('payment_reserves')
        .update({ status: onHold ? 'on_hold' : 'held' })
        .eq('reference', reference)
        .in('status', onHold ? ['held'] : ['on_hold'])
    if (error) throw new Error(error.message)
    revalidatePath('/admin/payouts')
}

/** Trusted organizers have nothing held from new sales. */
export async function setOrganizerTrust(organizerId: string, trusted: boolean) {
    await requireSuperAdmin()
    const { error } = await createAdminClient().schema('gatepass').from('organizer_payout_accounts')
        .update({ trust_level: trusted ? 'trusted' : 'new', updated_at: new Date().toISOString() })
        .eq('organizer_id', organizerId)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/payouts')
}
