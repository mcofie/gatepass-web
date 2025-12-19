'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { updateFeeSettings } from '@/app/actions/settings'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader2 } from 'lucide-react'

interface SystemSettingsClientProps {
    initialPlatformFee: number
    initialProcessorFee: number
}

export function SystemSettingsClient({ initialPlatformFee, initialProcessorFee }: SystemSettingsClientProps) {
    const [platformFee, setPlatformFee] = useState(initialPlatformFee * 100) // Display as %
    const [processorFee, setProcessorFee] = useState(initialProcessorFee * 100)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            // Convert back to decimal
            await updateFeeSettings(platformFee / 100, processorFee / 100)
            toast.success('Settings updated successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to update settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Fee Configuration</h2>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Platform Fee (%)
                            </label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={platformFee}
                                    onChange={(e) => setPlatformFee(parseFloat(e.target.value))}
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                            </div>
                            <p className="text-xs text-gray-500">
                                The fee taken by GatePass. (Default: 4%)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Payment Processor Fee (%)
                            </label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={processorFee}
                                    onChange={(e) => setProcessorFee(parseFloat(e.target.value))}
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                            </div>
                            <p className="text-xs text-gray-500">
                                The fee charged by Paystack/Stripe. (Default: 1.95%)
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-black text-white dark:bg-white dark:text-black hover:opacity-90 min-w-[120px]"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
