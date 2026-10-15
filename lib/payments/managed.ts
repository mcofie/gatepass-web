import { createAdminClient } from '@/utils/supabase/admin'
import { PaymentProviderError, readJson } from './types'

// GatePass Payments: sales go through GatePass's own Paystack account and are split at checkout.
// Paystack subaccounts settle in the platform account's country, so this works for organizers
// paid in that country's currency (PLATFORM_PAYSTACK_COUNTRY / PLATFORM_PAYSTACK_CURRENCY).

const API = 'https://api.paystack.co'

export type ManagedTerms = { feePercent: number; reservePercent: number; releaseHours: number }

export const managedCountry = () => (process.env.PLATFORM_PAYSTACK_COUNTRY || 'ghana').toLowerCase()
export const managedCurrency = () => (process.env.PLATFORM_PAYSTACK_CURRENCY || 'GHS').toUpperCase()

function secret(): string {
    const key = process.env.PAYSTACK_SECRET_KEY
    if (!key) throw new Error('PAYSTACK_SECRET_KEY is not defined')
    return key
}

async function paystack(path: string, init?: RequestInit) {
    const response = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        cache: 'no-store',
    })
    const data = await readJson(response)
    if (!response.ok || data.status === false) throw new PaymentProviderError(data.message || `Paystack responded with ${response.status}`)
    return data.data
}

/** Fee, reserve and release delay, from system_settings with safe defaults. */
export async function getManagedTerms(): Promise<ManagedTerms> {
    const { data } = await createAdminClient().schema('gatepass').from('system_settings').select('value').eq('key', 'managed_payments').maybeSingle()
    const value = (data?.value ?? {}) as Partial<{ fee_percent: number; reserve_percent: number; release_hours: number }>
    return {
        feePercent: Number(value.fee_percent ?? 5),
        reservePercent: Number(value.reserve_percent ?? 25),
        releaseHours: Number(value.release_hours ?? 48),
    }
}

export type PayoutBank = { name: string; code: string; type: string }

/** Banks or mobile money networks Paystack can settle to in the platform's country. */
export async function listPayoutBanks(kind: 'bank' | 'mobile_money'): Promise<PayoutBank[]> {
    const params = new URLSearchParams({ country: managedCountry(), currency: managedCurrency(), perPage: '200' })
    if (kind === 'mobile_money') params.set('type', 'mobile_money')
    const banks = (await paystack(`/bank?${params}`)) as { name: string; code: string; type: string; active?: boolean }[]
    return banks
        .filter(b => b.active !== false && (kind === 'mobile_money' ? b.type === 'mobile_money' : b.type !== 'mobile_money'))
        .map(b => ({ name: b.name, code: b.code, type: b.type }))
        .sort((a, b) => a.name.localeCompare(b.name))
}

/** The account holder's name, so organizers can confirm they typed the right number. */
export async function resolveAccountName(accountNumber: string, bankCode: string): Promise<string> {
    const data = await paystack(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`)
    if (!data?.account_name) throw new PaymentProviderError('We couldn’t confirm that account. Check the number and try again.')
    return data.account_name
}

export async function createSubaccount(input: { businessName: string; bankCode: string; accountNumber: string; email?: string | null }): Promise<string> {
    const data = await paystack('/subaccount', {
        method: 'POST',
        body: JSON.stringify({
            business_name: input.businessName.slice(0, 100),
            settlement_bank: input.bankCode,
            account_number: input.accountNumber,
            // The split is set per sale with transaction_charge; the percentage is unused
            percentage_charge: 0,
            primary_contact_email: input.email ?? undefined,
        }),
    })
    return data.subaccount_code
}

export async function createTransferRecipient(input: { name: string; type: string; bankCode: string; accountNumber: string }): Promise<string> {
    const data = await paystack('/transferrecipient', {
        method: 'POST',
        body: JSON.stringify({ type: input.type, name: input.name, account_number: input.accountNumber, bank_code: input.bankCode, currency: managedCurrency() }),
    })
    return data.recipient_code
}

/** How a sale of this size is split. */
export function splitSale(amountMinor: number, terms: ManagedTerms, trusted: boolean) {
    const feeMinor = Math.round(amountMinor * terms.feePercent / 100)
    const reserveMinor = trusted ? 0 : Math.round((amountMinor - feeMinor) * terms.reservePercent / 100)
    return { feeMinor, reserveMinor }
}
