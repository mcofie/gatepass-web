'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { markReserveReleased, setOrganizerTrust, setReserveOnHold } from '@/app/actions/admin-payouts'
import { Switch } from '@/components/dashboard/ui'

export function PayoutActions({ reference, status }: { reference: string; status: string }) {
    const [pending, start] = useTransition()
    const run = (fn: () => Promise<void>, done: string) => start(async () => {
        try { await fn(); toast.success(done) } catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong') }
    })

    return (
        <div className="flex items-center gap-2">
            {pending && <Loader2 className="size-4 animate-spin text-gray-400" aria-hidden="true" />}
            <button type="button" disabled={pending} onClick={() => run(() => setReserveOnHold(reference, status !== 'on_hold'), status === 'on_hold' ? 'Hold resumed' : 'Hold paused')} className="h-8 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                {status === 'on_hold' ? 'Resume' : 'Pause'}
            </button>
            <button
                type="button"
                disabled={pending || status === 'on_hold'}
                onClick={() => {
                    const note = window.prompt('Paid in Paystack? Add the transfer reference (optional):')
                    if (note === null) return
                    run(() => markReserveReleased(reference, note), 'Marked as released')
                }}
                className="h-8 rounded-full bg-gray-950 px-3 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
                Mark released
            </button>
        </div>
    )
}

export function TrustToggle({ organizerId, trusted }: { organizerId: string; trusted: boolean }) {
    const [value, setValue] = useState(trusted)
    const [pending, start] = useTransition()
    return (
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {value ? 'Trusted' : 'New'}
            <Switch
                label="Trusted organizer"
                checked={value}
                disabled={pending}
                onChange={next => start(async () => {
                    setValue(next)
                    try { await setOrganizerTrust(organizerId, next); toast.success(next ? 'Organizer trusted: nothing held from new sales' : 'New sales will be partly held') }
                    catch (e) { setValue(!next); toast.error(e instanceof Error ? e.message : 'Could not update') }
                })}
            />
        </label>
    )
}
