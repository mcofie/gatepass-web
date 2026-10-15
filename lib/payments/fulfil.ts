import { confirmPayment } from '@/lib/payments'
import { processSuccessfulPayment } from '@/utils/actions/payment'
import { notifyDiscord } from '@/utils/discord'
import type { ResolvedIntegration } from '@/lib/integrations/store'

/**
 * Confirms a payment session with its provider and issues tickets (or settles instalments).
 * Shared by per-organizer webhooks and GatePass's own Paystack webhook. Safe to call twice.
 */
export async function fulfilConfirmedSession(reference: string, integration?: ResolvedIntegration): Promise<{ status: 'success' | 'pending' | 'failed' }> {
    const session = { reference }
    const provider = integration?.provider ?? 'gatepass'
    const confirmation = await confirmPayment(session.reference, integration)
    if (confirmation.status !== 'success') return { status: confirmation.status }

    const { transaction } = confirmation
    const metadata = confirmation.session.metadata as {
        payment_type?: string
        is_full_payment?: boolean
        instalment_payment_id?: string
        instalment_reservation_id?: string
    }
    const amount = `${transaction.currency} ${(transaction.amount / 100).toLocaleString()}`

    if (metadata.payment_type === 'instalment') {
        const instalments = await import('@/utils/actions/instalment')
        if (metadata.is_full_payment && metadata.instalment_reservation_id) {
            const result = await instalments.processFullInstalmentPayment(session.reference, metadata.instalment_reservation_id, transaction)
            if (!result.success) throw new Error(result.error)
            await notifyDiscord(`💰 **Full Instalment Settled**\n**Amount:** ${amount}\n**Res ID:** ${metadata.instalment_reservation_id}`, 'success')
        } else if (metadata.instalment_payment_id) {
            const result = await instalments.processInstalmentPayment(session.reference, metadata.instalment_payment_id, transaction)
            if (!result.success) throw new Error(result.error)
            await notifyDiscord(`💳 **Instalment Payment Received**\n**Amount:** ${amount}\n**Payment ID:** ${metadata.instalment_payment_id}`, 'success')
        }
    } else if (metadata.payment_type === 'instalment_first') {
        // The deposit is activated by the buyer's return page, which creates the plan's schedule
        await notifyDiscord(`✨ **First Instalment Deposit**\n**Amount:** ${amount}\n**Ref:** ${session.reference}`, 'success')
    } else {
        const result = await processSuccessfulPayment(session.reference, confirmation.session.reservation_ids, transaction)
        if (!result.success) throw new Error(result.error)
        await notifyDiscord(`🎉 **Ticket Purchase**\n**Provider:** ${provider}\n**Amount:** ${amount}\n**Ref:** ${session.reference}`, 'success')
    }

    return { status: 'success' }
}
