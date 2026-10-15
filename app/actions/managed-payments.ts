'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { assertCanManage } from '@/lib/integrations/auth'
import {
    createSubaccount, createTransferRecipient, getManagedTerms, listPayoutBanks, managedCountry, managedCurrency, resolveAccountName,
    type ManagedTerms, type PayoutBank,
} from '@/lib/payments/managed'
import { PaymentProviderError } from '@/lib/payments/types'

export type ManagedPaymentsSetup = {
    available: boolean
    country: string
    currency: string
    terms: ManagedTerms
    account: null | {
        accountType: 'bank' | 'mobile_money'
        bankName: string
        accountName: string
        accountNumberHint: string
        trustLevel: 'new' | 'trusted'
    }
    heldMinor: number
}

const readable = (error: unknown, fallback: string) =>
    error instanceof PaymentProviderError || error instanceof Error ? error.message : fallback

export async function getManagedPaymentsSetup(organizerId: string): Promise<ManagedPaymentsSetup> {
    await assertCanManage(organizerId)
    const db = createAdminClient().schema('gatepass')
    const [terms, { data: account }, { data: held }] = await Promise.all([
        getManagedTerms(),
        db.from('organizer_payout_accounts').select('*').eq('organizer_id', organizerId).maybeSingle(),
        db.from('payment_reserves').select('amount_minor').eq('organizer_id', organizerId).in('status', ['held', 'releasing', 'on_hold']),
    ])
    return {
        available: Boolean(process.env.PAYSTACK_SECRET_KEY),
        country: managedCountry(),
        currency: managedCurrency(),
        terms,
        account: account ? {
            accountType: account.account_type,
            bankName: account.bank_name,
            accountName: account.account_name,
            accountNumberHint: String(account.account_number).slice(-4),
            trustLevel: account.trust_level,
        } : null,
        heldMinor: (held ?? []).reduce((sum, r) => sum + Number(r.amount_minor), 0),
    }
}

export async function listPayoutOptions(organizerId: string, kind: 'bank' | 'mobile_money'): Promise<PayoutBank[]> {
    await assertCanManage(organizerId)
    return listPayoutBanks(kind)
}

export async function lookupPayoutAccount(organizerId: string, bankCode: string, accountNumber: string): Promise<{ accountName: string }> {
    await assertCanManage(organizerId)
    const number = accountNumber.replace(/\s+/g, '')
    if (!/^\d{6,20}$/.test(number)) throw new Error('Enter the account or mobile money number without spaces or symbols')
    try {
        return { accountName: await resolveAccountName(number, bankCode) }
    } catch (error) {
        throw new Error(readable(error, 'We couldn’t confirm that account'))
    }
}

/**
 * Creates the organizer's Paystack subaccount and payout recipient, and adds GatePass Payments
 * as a payment option (the default when they have none). Re-running replaces the payout account.
 */
export async function setupManagedPayments(organizerId: string, input: { kind: 'bank' | 'mobile_money'; bankCode: string; accountNumber: string }) {
    const user = await assertCanManage(organizerId)
    if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('GatePass Payments isn’t available yet')
    const db = createAdminClient().schema('gatepass')
    const accountNumber = input.accountNumber.replace(/\s+/g, '')

    try {
        const banks = await listPayoutBanks(input.kind)
        const bank = banks.find(b => b.code === input.bankCode)
        if (!bank) throw new Error('Choose your bank or mobile money network')

        const accountName = await resolveAccountName(accountNumber, bank.code)
        const { data: org } = await db.from('organizers').select('name').eq('id', organizerId).single()
        const subaccountCode = await createSubaccount({ businessName: org?.name || accountName, bankCode: bank.code, accountNumber, email: user.email })
        const recipientCode = await createTransferRecipient({ name: accountName, type: bank.type, bankCode: bank.code, accountNumber })

        const { data: existing } = await db.from('organizer_payout_accounts').select('trust_level').eq('organizer_id', organizerId).maybeSingle()
        const { error: accountError } = await db.from('organizer_payout_accounts').upsert({
            organizer_id: organizerId,
            country: managedCountry(),
            currency: managedCurrency(),
            account_type: input.kind,
            bank_code: bank.code,
            bank_name: bank.name,
            account_number: accountNumber,
            account_name: accountName,
            paystack_subaccount_code: subaccountCode,
            paystack_recipient_code: recipientCode,
            trust_level: existing?.trust_level ?? 'new',
            created_by: user.id,
            updated_at: new Date().toISOString(),
        })
        if (accountError) throw new Error(accountError.message)

        // GatePass Payments becomes a payment option, and the default if there isn't one
        const { count } = await db.from('organizer_integrations').select('id', { count: 'exact', head: true }).eq('organizer_id', organizerId).eq('category', 'payments').eq('is_default', true).neq('provider', 'gatepass')
        const { error } = await db.from('organizer_integrations').upsert({
            organizer_id: organizerId,
            category: 'payments',
            provider: 'gatepass',
            mode: 'live',
            public_config: { currency: managedCurrency() },
            encrypted_credentials: null,
            credential_hints: {},
            status: 'connected',
            status_message: `Paid out to ${bank.name} ••••${accountNumber.slice(-4)}`,
            last_verified_at: new Date().toISOString(),
            is_default: (count ?? 0) === 0,
            created_by: user.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'organizer_id,category,provider' })
        if (error) throw new Error(error.message)

        revalidatePath('/dashboard/settings')
        return { accountName }
    } catch (error) {
        throw new Error(readable(error, 'Could not set up GatePass Payments'))
    }
}
