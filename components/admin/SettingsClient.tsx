'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SettingsClient({ initialSettings }: { initialSettings: any }) {
    const supabase = createClient()
    const router = useRouter()
    const [settings, setSettings] = useState(initialSettings || {
        fee_percentage: 0,
        fee_fixed: 0,
        is_maintenance_mode: false
    })
    const [loading, setLoading] = useState(false)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            let result;

            if (initialSettings?.id) {
                result = await supabase.schema('gatepass').from('platform_settings').update({
                    fee_percentage: settings.fee_percentage,
                    fee_fixed: settings.fee_fixed,
                    is_maintenance_mode: settings.is_maintenance_mode,
                    updated_at: new Date().toISOString()
                }).eq('id', initialSettings.id)
            } else {
                result = await supabase.schema('gatepass').from('platform_settings').insert({
                    fee_percentage: settings.fee_percentage,
                    fee_fixed: settings.fee_fixed,
                    is_maintenance_mode: settings.is_maintenance_mode
                })
            }

            const { error } = result

            if (error) throw error
            alert('Settings saved successfully')
            router.refresh()
        } catch (e: any) {
            alert('Error saving settings: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-8">Platform Settings</h1>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Fees Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </span>
                        Fees Configuration
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Percentage Fee (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.fee_percentage}
                                    onChange={e => setSettings({ ...settings, fee_percentage: Number(e.target.value) })}
                                    className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Taken from every ticket sale.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Fixed Fee (GHS)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.fee_fixed}
                                    onChange={e => setSettings({ ...settings, fee_fixed: Number(e.target.value) })}
                                    className="w-full pl-3 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-500">GHS</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Additional fixed amount per ticket.</p>
                        </div>
                    </div>
                </div>

                {/* System Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="bg-gray-100 text-gray-600 p-1.5 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </span>
                        System Controls
                    </h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">Maintenance Mode</p>
                            <p className="text-sm text-gray-500">Disable all public access to events.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.is_maintenance_mode}
                                onChange={e => setSettings({ ...settings, is_maintenance_mode: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    )
}
