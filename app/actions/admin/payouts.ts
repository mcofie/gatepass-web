'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createTransferRecipient, initiateTransfer } from '@/utils/paystack'
import { notifyDiscord } from '@/utils/discord'
import { sendPayoutEmail } from '@/utils/email'
import { formatCurrency } from '@/utils/format'

// Approve (Mark as Paid)
export async function approvePayout(payoutId: string, reference?: string) {
    const supabase = await createClient()

    try {
        // Verify Super Admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) throw new Error('Unauthorized')

        // 1. Fetch Payout & Organizer details
        const { data: payout } = await supabase
            .schema('gatepass')
            .from('payouts')
            .select(`
                *,
                organizers:organizer_id (
                    id,
                    name,
                    bank_name,
                    account_number,
                    account_name,
                    paystack_recipient_code,
                    paystack_bank_code,
                    profiles:user_id (email)
                ),
                events:event_id (title)
            `)
            .eq('id', payoutId)
            .single()

        if (!payout) throw new Error('Payout request not found')
        const organizer = payout.organizers as any

        if (!organizer.bank_name || !organizer.account_number) {
            throw new Error('Organizer has not set up bank details')
        }

        // 2. Prepare Paystack Recipient
        let recipientCode = organizer.paystack_recipient_code
        const bankCode = organizer.bank_code || organizer.paystack_bank_code

        if (!recipientCode) {
            if (!bankCode) {
                throw new Error('Bank code missing. Please update organizer bank details with correct bank code.')
            }

            recipientCode = await createTransferRecipient(
                organizer.account_name || organizer.name,
                organizer.account_number,
                bankCode,
                payout.currency || 'GHS'
            )

            // Save for future use
            await supabase
                .schema('gatepass')
                .from('organizers')
                .update({ paystack_recipient_code: recipientCode })
                .eq('id', organizer.id)
        }

        // 3. Determine Transfer Fee (Ghana only for now)
        let transferFee = 0
        if (payout.currency === 'GHS') {
            const isMomo = organizer.bank_name?.toLowerCase().includes('mobile money') ||
                organizer.bank_name?.toLowerCase().includes('mtn') ||
                organizer.bank_name?.toLowerCase().includes('vodafone') ||
                organizer.bank_name?.toLowerCase().includes('airteltigo') ||
                organizer.bank_name?.toLowerCase().includes('telecel')

            transferFee = isMomo ? 1.00 : 8.00
        } else if (payout.currency === 'NGN') {
            if (payout.amount <= 5000) transferFee = 10
            else if (payout.amount <= 50000) transferFee = 25
            else transferFee = 50
        }

        const amountToTransfer = Math.max(0, payout.amount - transferFee)
        if (amountToTransfer <= 0) {
            throw new Error(`Payout amount is too small to cover the transfer fee of ${payout.currency} ${transferFee}`)
        }

        // 4. Initiate Transfer
        const transferRef = `gp_payout_${payoutId.slice(0, 8)}_${Date.now()}`
        const transfer = await initiateTransfer(
            amountToTransfer,
            recipientCode,
            `Payout for ${payout.event_id} (Fee: ${transferFee} deducted)`,
            transferRef
        )

        // 5. Update Payout record
        const { error: updateError } = await supabase
            .schema('gatepass')
            .from('payouts')
            .update({
                status: 'processing',
                paid_at: new Date().toISOString(),
                processed_by: user.id,
                reference: transfer.reference,
                notes: `Transfer initiated: ${payout.currency} ${amountToTransfer.toFixed(2)} (Fee: ${transferFee.toFixed(2)} deducted). Ref: ${transfer.reference}`
            })
            .eq('id', payoutId)

        if (updateError) throw updateError

        // 6. Notify Discord & Email Organizer
        const orgEmail = (organizer.profiles as any)?.email
        const eventTitle = (payout.events as any)?.title || 'Your Event'

        await notifyDiscord(
            `💸 **Payout Sent**\n` +
            `**Organizer:** ${organizer.name}\n` +
            `**Amount:** ${formatCurrency(amountToTransfer, payout.currency)}\n` +
            `**Event:** ${eventTitle}\n` +
            `**Ref:** ${transfer.reference}`,
            'success'
        )

        if (orgEmail) {
            await sendPayoutEmail({
                to: orgEmail,
                organizerName: organizer.name,
                amount: formatCurrency(amountToTransfer, payout.currency),
                reference: transfer.reference,
                eventName: eventTitle,
                date: new Date().toLocaleDateString()
            }).catch(err => console.error('Email failed:', err))
        }

        revalidatePath('/admin/payouts')
        return { success: true, message: 'Transfer initiated successfully' }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

// Reject
export async function rejectPayout(payoutId: string, reason?: string) {
    const supabase = await createClient()

    try {
        // Verify Super Admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) throw new Error('Unauthorized')

        const { error } = await supabase
            .schema('gatepass')
            .from('payouts')
            .update({
                status: 'failed',
                processed_by: user.id,
                notes: reason ? `Rejected: ${reason}` : 'Rejected by admin'
            })
            .eq('id', payoutId)

        if (error) throw error

        revalidatePath('/admin/payouts')
        return { success: true }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

// Reset System (Clear Data)
export async function resetPayoutSystem() {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) throw new Error('Unauthorized')

        // Delete order: Tickets -> Transactions -> Payouts -> Reservations
        // This avoids foreign key constraint issues if any
        
        // 1. Clear Tickets
        await supabase.schema('gatepass').from('tickets').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000')
        
        // 2. Clear Transactions
        await supabase.schema('gatepass').from('transactions').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000')

        // 3. Clear Payouts
        await supabase.schema('gatepass').from('payouts').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000')

        // 4. Clear Reservations
        await supabase.schema('gatepass').from('reservations').delete().filter('id', 'neq', '00000000-0000-0000-0000-000000000000')

        revalidatePath('/admin/payouts')
        return { success: true, message: 'System reset successfully. All balances are now zero.' }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

// Settle Balances Manually
export async function settleBalances(settlements: { event_id: string; organizer_id: string; amount: number; currency: string }[]) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_super_admin) throw new Error('Unauthorized')

        if (settlements.length === 0) return { success: true, message: 'No balances to settle' }

        const payoutEntries = settlements.map(s => ({
            event_id: s.event_id,
            organizer_id: s.organizer_id,
            amount: s.amount,
            currency: s.currency,
            status: 'paid',
            paid_at: new Date().toISOString(),
            processed_by: user.id,
            notes: 'Manually settled - paid through other means'
        }))

        const { error } = await supabase
            .schema('gatepass')
            .from('payouts')
            .insert(payoutEntries)

        if (error) throw error

        revalidatePath('/admin/payouts')
        return { success: true, message: `${settlements.length} event balances settled successfully` }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}
