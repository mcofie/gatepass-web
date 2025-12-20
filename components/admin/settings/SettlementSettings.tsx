import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Building, CreditCard, CheckCircle2 } from 'lucide-react'
import { createPaystackSubaccount, getPaystackBanks, verifyPaystackAccount } from '@/app/actions/paystack'
import { PLATFORM_FEE_PERCENT } from '@/utils/fees'

export function SettlementSettings({ organizer }: { organizer: any }) {
    const [loading, setLoading] = useState(false)
    const [banks, setBanks] = useState<{ name: string, code: string }[]>([])
    const [verifying, setVerifying] = useState(false)
    const [isVerified, setIsVerified] = useState(!!organizer?.paystack_subaccount_code)

    // State
    const [selectedBankCode, setSelectedBankCode] = useState(organizer?.bank_code || '')
    const [accountNumber, setAccountNumber] = useState(organizer?.account_number || '')
    const [businessName, setBusinessName] = useState(organizer?.name || '')
    const [paystackCode, setPaystackCode] = useState(organizer?.paystack_subaccount_code || '')

    // Fetch banks on mount
    React.useEffect(() => {
        const fetchBanks = async () => {
            const list = await getPaystackBanks()
            if (list) setBanks(list)
        }
        fetchBanks()
    }, [])

    // Verify Account when details change
    React.useEffect(() => {
        const timer = setTimeout(async () => {
            // Only verify if not already connected or if details changed
            if (accountNumber && selectedBankCode && accountNumber.length >= 10) {
                // Skip if it matches existing props (already verified)
                if (accountNumber === organizer?.account_number && selectedBankCode === organizer?.bank_code && paystackCode) {
                    setIsVerified(true)
                    return
                }

                setVerifying(true)
                const result = await verifyPaystackAccount(accountNumber, selectedBankCode)
                setVerifying(false)

                if (result.success) {
                    setIsVerified(true)
                    setBusinessName(result.account_name) // Auto-fill business name
                    toast.success(`Account verified: ${result.account_name}`)
                } else {
                    setIsVerified(false)
                    toast.error('Could not verify account details')
                }
            } else {
                if (!paystackCode) setIsVerified(false)
            }
        }, 1000)

        return () => clearTimeout(timer)
    }, [accountNumber, selectedBankCode, organizer?.account_number, organizer?.bank_code, paystackCode])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (!businessName || !selectedBankCode || !accountNumber) {
                toast.error('All fields are required')
                return
            }

            if (!isVerified) {
                toast.error('Please perform account verification first')
                return
            }

            // Call Server Action
            const result = await createPaystackSubaccount({
                business_name: businessName,
                settlement_bank: selectedBankCode,
                account_number: accountNumber,
                percentage_charge: PLATFORM_FEE_PERCENT * 100 // Default split percentage
            }, organizer.id)

            if (result.success) {
                setPaystackCode(result.subaccount_code)
                toast.success('Settlement account connected successfully!')
            }

        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="max-w-2xl bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div
                    className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-500">
                    <Building className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Settlement Account</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Where should we send your payouts?</p>
                </div>
            </div>

            {paystackCode && (
                <div
                    className="bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-xl p-4 flex items-center gap-3 mb-8">
                    <div
                        className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-green-800 dark:text-green-400">Account Connected</p>
                        <p className="text-xs text-green-600 dark:text-green-500/80">Subaccount: {paystackCode}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                <div
                    className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 mb-6">
                    <p className="font-bold mb-1">Important</p>
                    Please ensure these details are exactly as they appear on your bank statement to avoid payout
                    delays.
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Bank Name</label>
                        <select
                            value={selectedBankCode}
                            onChange={e => setSelectedBankCode(e.target.value)}
                            className="w-full h-12 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all appearance-none"
                        >
                            <option value="">Select Bank</option>
                            {banks.map((bank, i) => (
                                <option key={`${bank.code}-${i}`} value={bank.code}>
                                    {bank.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Account
                            Number</label>
                        <Input
                            value={accountNumber}
                            onChange={e => setAccountNumber(e.target.value)}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                            placeholder="0123456789"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Account Name
                        (Auto-verified)</label>
                    <div className="relative">
                        <Input
                            value={businessName}
                            readOnly
                            className="h-12 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white cursor-not-allowed text-gray-500"
                            placeholder="Will appear after verification"
                        />
                        {verifying && (
                            <div className="absolute right-4 top-3.5">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                        )}
                    </div>
                    {isVerified && !verifying && (
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium ml-1">
                            ✓ Verified Account Name
                        </p>
                    )}
                </div>

                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={loading || !isVerified || verifying}
                        className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {paystackCode ? 'Update Details' : 'Connect Account'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
