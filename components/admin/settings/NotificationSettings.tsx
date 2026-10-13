'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { Field, Notice, Panel, PrimaryButton, SectionIntro, Switch, inputClass } from '@/components/dashboard/ui'

type Organizer = { id: string; notify_on_sale?: boolean | null; notification_email?: string | null }

export function NotificationSettings({ organizer, userRole }: { organizer: Organizer | null; userRole: string }) {
    if (!organizer) return null
    return <NotificationForm organizer={organizer} canEdit={userRole === 'Owner' || userRole === 'Admin'} />
}

function NotificationForm({ organizer, canEdit }: { organizer: Organizer; canEdit: boolean }) {
    const router = useRouter()
    const supabase = React.useMemo(() => createClient(), [])
    const [loading, setLoading] = useState(false)
    const [notifyOnSale, setNotifyOnSale] = useState(organizer.notify_on_sale ?? false)
    const [notificationEmail, setNotificationEmail] = useState(organizer.notification_email || '')

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const address = notificationEmail.trim()
            if (notifyOnSale && !address) throw new Error('Add the email address to notify.')
            if (address && !/^\S+@\S+\.\S+$/.test(address)) throw new Error('Enter a valid email address.')

            const { error } = await supabase.schema('gatepass').from('organizers').update({
                notify_on_sale: notifyOnSale,
                notification_email: address || null,
            }).eq('id', organizer.id)
            if (error) throw error

            toast.success('Notifications saved')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl space-y-8">
            <SectionIntro eyebrow="Notifications" title="Know when you sell." description="Get an email the moment someone buys a ticket." />

            <form onSubmit={handleSave} className="space-y-6">
                <Panel>
                    <div className="flex items-start justify-between gap-6">
                        <div>
                            <label htmlFor="notify-on-sale" className="text-sm font-medium text-gray-950 dark:text-white">Email me on every sale</label>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Includes the buyer, ticket type and amount.</p>
                        </div>
                        <Switch id="notify-on-sale" label="Email me on every sale" checked={notifyOnSale} onChange={setNotifyOnSale} disabled={!canEdit} />
                    </div>

                    {notifyOnSale && (
                        <div className="mt-6 border-t border-gray-100 pt-6 dark:border-white/10">
                            <Field label="Send to" htmlFor="notification-email">
                                <input id="notification-email" type="email" autoComplete="email" value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} disabled={!canEdit} className={inputClass} placeholder="sales@yourteam.com" />
                            </Field>
                        </div>
                    )}
                </Panel>

                {canEdit
                    ? <div className="flex justify-end"><PrimaryButton type="submit" loading={loading}>Save notifications</PrimaryButton></div>
                    : <Notice>Only owners and admins can change notifications.</Notice>}
            </form>
        </div>
    )
}
