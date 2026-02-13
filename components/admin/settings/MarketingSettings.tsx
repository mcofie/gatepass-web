'use client'

import React from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Share2, Target, BarChart3 } from 'lucide-react'

export function MarketingSettings({ organizer, userRole }: { organizer: any, userRole: string }) {
    if (!organizer) return null

    const [loading, setLoading] = React.useState(false)
    const canEdit = userRole === 'Owner' || userRole === 'Admin'
    const [metaPixelId, setMetaPixelId] = React.useState(organizer?.meta_pixel_id || '')
    const [ga4Id, setGa4Id] = React.useState(organizer?.ga4_measurement_id || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .update({
                    meta_pixel_id: metaPixelId,
                    ga4_measurement_id: ga4Id
                })
                .eq('id', organizer.id)

            if (error) throw error
            toast.success('Marketing settings saved')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-8">
            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
                        <Target className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Marketing Tracking</h3>
                        <p className="text-sm text-gray-500">Connect your external analytics and ad platforms.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Meta Pixel ID</label>
                        <Input
                            value={metaPixelId}
                            onChange={e => setMetaPixelId(e.target.value)}
                            disabled={!canEdit}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                            placeholder="1234567890"
                        />
                        <p className="text-[10px] text-gray-400 ml-1">Connect your Instagram and Facebook ads to track purchases.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Google Analytics 4 ID</label>
                        <Input
                            value={ga4Id}
                            onChange={e => setGa4Id(e.target.value)}
                            disabled={!canEdit}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                            placeholder="G-XXXXXXXXXX"
                        />
                        <p className="text-[10px] text-gray-400 ml-1">Enter your GA4 Measurement ID to track visitor behavior.</p>
                    </div>

                    {canEdit ? (
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Tracking IDs
                            </Button>
                        </div>
                    ) : (
                        <div className="pt-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">
                                Only Owners and Admins can modify marketing settings.
                            </p>
                        </div>
                    )}
                </form>
            </div>

            <div className="bg-blue-50 dark:bg-blue-500/5 rounded-3xl p-8 border border-blue-100 dark:border-blue-500/10">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-blue-900 dark:text-blue-400">How tracking works</h4>
                        <p className="text-sm text-blue-800/70 dark:text-blue-400/60 leading-relaxed">
                            Once you add these IDs, Gatepass will automatically inject the necessary scripts into your public event pages and fire <strong>Purchase</strong> events whenever a ticket is sold. This allows Meta and Google to accurately attribute sales to your ad campaigns.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
