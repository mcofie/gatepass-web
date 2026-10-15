import { createAdminClient } from '@/utils/supabase/admin'
import { gatepassAccount } from '@/lib/billing'
import { getManagedTerms, splitSale } from '../managed'
import { PaymentProviderError, readJson, type PaymentAdapter } from '../types'
import { paystack } from './paystack'

/**
 * GatePass Payments: a Paystack split on GatePass's own account.
 * GatePass's fee and any reserve go to the main account (transaction_charge);
 * the rest settles to the organizer's subaccount, which also bears Paystack's fees.
 */
export const gatepassPayments: PaymentAdapter = {
    async createCheckout(integration, input) {
        const db = createAdminClient().schema('gatepass')
        const { data: account } = await db.from('organizer_payout_accounts').select('paystack_subaccount_code, trust_level').eq('organizer_id', integration.organizerId).maybeSingle()
        if (!account?.paystack_subaccount_code) throw new PaymentProviderError('This organizer hasn’t finished setting up GatePass Payments.')

        const terms = await getManagedTerms()
        const { feeMinor, reserveMinor } = splitSale(input.amountMinor, terms, account.trust_level === 'trusted')

        // Keep the split with the session, so later changes to the terms don't affect this sale
        const { data: session } = await db.from('payment_sessions').select('metadata').eq('reference', input.reference).single()
        await db.from('payment_sessions').update({
            metadata: { ...(session?.metadata ?? {}), managed: { fee_minor: feeMinor, reserve_minor: reserveMinor, fee_percent: terms.feePercent, reserve_percent: account.trust_level === 'trusted' ? 0 : terms.reservePercent, release_hours: terms.releaseHours } },
        }).eq('reference', input.reference)

        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${gatepassAccount().credentials.secret_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: input.email,
                amount: input.amountMinor,
                currency: input.currency,
                reference: input.reference,
                callback_url: input.returnUrl,
                metadata: input.metadata,
                subaccount: account.paystack_subaccount_code,
                transaction_charge: feeMinor + reserveMinor,
                bearer: 'subaccount',
            }),
        })
        const data = await readJson(response)
        if (!response.ok || !data.status) throw new PaymentProviderError(data.message || 'Paystack could not start this payment')
        return { redirectUrl: data.data.authorization_url, providerReference: input.reference }
    },

    async fetchTransaction(_integration, session) {
        const tx = await paystack.fetchTransaction(gatepassAccount(), session)
        return { ...tx, provider: 'gatepass' }
    },

    // Paystack sends GatePass-account webhooks to /api/billing/webhook, signed with the platform key
    async parseWebhook(_integration, request) {
        return paystack.parseWebhook(gatepassAccount(), request)
    },
}
