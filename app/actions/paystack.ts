'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface PaystackSettlementData {
    business_name: string
    settlement_bank: string // this is the bank code
    account_number: string
    percentage_charge: number
    description?: string
}

export async function createPaystackSubaccount(formData: PaystackSettlementData, organizerId: string) {
    const supabase = await createClient()

    // 1. Verify User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 2. Prepare Paystack Payload
    const payload = {
        business_name: formData.business_name,
        settlement_bank: formData.settlement_bank,
        account_number: formData.account_number,
        percentage_charge: formData.percentage_charge,
        description: formData.description || `Settlement for ${formData.business_name}`
    }

    try {
        // 3. Call Paystack API
        const response = await fetch('https://api.paystack.co/subaccount', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Failed to create subaccount on Paystack')
        }

        const data = await response.json()
        const subaccountCode = data.data.subaccount_code

        // 4. Save to Supabase
        const { error: dbError } = await supabase
            .schema('gatepass')
            .from('organizers')
            .update({
                paystack_subaccount_code: subaccountCode,
                bank_code: formData.settlement_bank,
                account_number: formData.account_number,
                bank_name: await getBankName(formData.settlement_bank) || 'Unknown Bank',
                account_name: formData.business_name // Or use what Paystack returns if verified
            })
            .eq('id', organizerId)

        if (dbError) throw new Error(dbError.message)

        revalidatePath('/dashboard/settings')
        return { success: true, subaccount_code: subaccountCode }

    } catch (error: any) {
        console.error('Paystack Subaccount Error:', error)
        throw new Error(error.message)
    }
}

// Helper to get bank list (can be client-side too, but good helper here)
export async function getPaystackBanks() {
    try {
        const response = await fetch('https://api.paystack.co/bank?country=ghana', {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        })
        const data = await response.json()
        return data.data
    } catch (e) {
        return []
    }
}

async function getBankName(code: string) {
    const banks: any[] = await getPaystackBanks()
    const bank = banks.find((b: any) => b.code === code)
    return bank ? bank.name : null
}

export async function verifyPaystackAccount(accountNumber: string, bankCode: string) {
    try {
        const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        })

        if (!response.ok) {
            throw new Error('Could not resolve account name')
        }

        const data = await response.json()
        return { success: true, account_name: data.data.account_name }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
