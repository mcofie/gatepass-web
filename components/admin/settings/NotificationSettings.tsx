'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Loader2, Bell, Mail } from 'lucide-react'

export function NotificationSettings({ organizer, userRole }: { organizer: any, userRole: string }) {
    if (!organizer) return null

    const [loading, setLoading] = useState(false)
    const canEdit = userRole === 'Owner' || userRole === 'Admin'

    const [notifyOnSale, setNotifyOnSale] = useState(organizer?.notify_on_sale ?? false)
    const [notificationEmail, setNotificationEmail] = useState(organizer?.notification_email || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Validate email if notification is on
            if (notifyOnSale && !notificationEmail.trim()) {
                throw new Error('Please provide a notification email address.')
            }

            if (notifyOnSale && notificationEmail && !/^\S+@\S+\.\S+$/.test(notificationEmail)) {
                throw new Error('Please provide a valid email address.')
            }

            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .update({
                    notify_on_sale: notifyOnSale,
                    notification_email: notificationEmail.trim() || null
                })
                .eq('id', organizer.id)

            if (error) throw error
            toast.success('Notification preferences saved')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white dark:text-black" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Notification Settings</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Configure how you want to be notified about ticket sales</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Sale Notifications Toggle */}
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                <Mail className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">Email on Ticket Sale</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Receive an email whenever someone buys a ticket</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifyOnSale}
                                onChange={(e) => setNotifyOnSale(e.target.checked)}
                                disabled={!canEdit}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-black/5 dark:peer-focus:ring-white/10 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white peer-disabled:opacity-50" />
                        </label>
                    </div>

                    {/* Email Input (shown when enabled) */}
                    {notifyOnSale && (
                        <div className="pt-4 border-t border-gray-200 dark:border-white/10 space-y-2 animate-fade-in">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Notification Email</label>
                            <Input
                                type="email"
                                value={notificationEmail}
                                onChange={e => setNotificationEmail(e.target.value)}
                                disabled={!canEdit}
                                className="h-12 bg-white dark:bg-black/30 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                                placeholder="your@email.com"
                            />
                            <p className="text-xs text-gray-400 ml-1">
                                We'll send sale notifications to this email address
                            </p>
                        </div>
                    )}
                </div>

                {canEdit ? (
                    <div className="pt-2">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Preferences
                        </Button>
                    </div>
                ) : (
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">
                            Only Owners and Admins can modify notification settings.
                        </p>
                    </div>
                )}
            </form>
        </div>
    )
}
