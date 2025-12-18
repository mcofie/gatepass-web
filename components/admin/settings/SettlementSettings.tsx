'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Building, CreditCard } from 'lucide-react'

export function SettlementSettings({ organizer }: { organizer: any }) {
    const [loading, setLoading] = useState(false)
    const [bankName, setBankName] = useState(organizer?.bank_name || '')
    const [accountNumber, setAccountNumber] = useState(organizer?.account_number || '')
    const [accountName, setAccountName] = useState(organizer?.account_name || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .update({
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_name: accountName
                })
                .eq('id', organizer.id)

            if (error) throw error
            toast.success('Settlement details saved')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                    <Building className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Settlement Account</h3>
                    <p className="text-sm text-gray-500">Where should we send your payouts?</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-6">
                    <p className="font-bold mb-1">Important</p>
                    Please ensure these details are exactly as they appear on your bank statement to avoid payout delays.
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Bank Name</label>
                    <Input
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                        placeholder="e.g. GTBank, Ecobank"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 ml-1">Account Number</label>
                        <Input
                            value={accountNumber}
                            onChange={e => setAccountNumber(e.target.value)}
                            className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                            placeholder="0123456789"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 ml-1">Account Name</label>
                        <Input
                            value={accountName}
                            onChange={e => setAccountName(e.target.value)}
                            className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                            placeholder="Acme Events Ltd"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-12 px-8 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Details
                    </Button>
                </div>
            </form>
        </div>
    )
}
