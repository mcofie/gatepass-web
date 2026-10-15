'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteOrganizationAsOwner, getOrganizationDeletionCheck, type DeletionCheck } from '@/app/actions/organization'
import { Field, inputClass } from '@/components/dashboard/ui'

/** Owner-only danger zone: explains what's kept and removed, shows blockers, and asks for the name. */
export function DeleteOrganizationPanel({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
    const router = useRouter()
    const [check, setCheck] = useState<DeletionCheck | null>(null)
    const [open, setOpen] = useState(false)
    const [confirmName, setConfirmName] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (!open) return
        let active = true
        getOrganizationDeletionCheck(organizationId).then(c => active && setCheck(c)).catch(() => active && setCheck({ upcomingTickets: 0, heldPayouts: 0 }))
        return () => { active = false }
    }, [open, organizationId])

    const blocked = !!check && (check.upcomingTickets > 0 || check.heldPayouts > 0)
    const matches = confirmName.trim() === organizationName.trim()

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await deleteOrganizationAsOwner(organizationId, confirmName)
            toast.success(`${organizationName} was deleted`)
            router.replace('/dashboard')
            router.refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not delete the organization')
            setDeleting(false)
        }
    }

    return (
        <section aria-labelledby="delete-org-heading" className="rounded-3xl border border-red-200/80 p-5 dark:border-red-500/20 sm:p-7">
            <h3 id="delete-org-heading" className="text-base font-semibold text-gray-950 dark:text-white">Delete organization</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Removes {organizationName} from GatePass for you and your team. Its events come off sale, and its payment connections, payout setup and team access are removed. Past orders and tickets are kept, so ticket holders and your records aren’t affected. This can’t be undone.
            </p>

            {!open ? (
                <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex h-9 items-center rounded-full border border-red-200 px-4 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10">
                    Delete organization…
                </button>
            ) : !check ? (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking…</p>
            ) : blocked ? (
                <div className="mt-4 space-y-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                    <p className="font-medium">You can’t delete it yet:</p>
                    <ul className="list-disc space-y-1 pl-5">
                        {check.upcomingTickets > 0 && <li>{check.upcomingTickets.toLocaleString()} tickets are still valid for upcoming events. Cancel or refund them from each event’s Guest list.</li>}
                        {check.heldPayouts > 0 && <li>GatePass is still holding money from your sales. It’s paid out after your events, and you can delete the organization then.</li>}
                    </ul>
                </div>
            ) : (
                <div className="mt-5 space-y-4">
                    <Field label={`Type “${organizationName}” to confirm`} htmlFor="delete-org-confirm">
                        <input id="delete-org-confirm" autoComplete="off" value={confirmName} onChange={e => setConfirmName(e.target.value)} className={inputClass} />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={!matches || deleting} onClick={handleDelete} className="inline-flex h-10 items-center rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                            {deleting ? 'Deleting…' : 'Delete organization'}
                        </button>
                        <button type="button" onClick={() => { setOpen(false); setConfirmName('') }} className="inline-flex h-10 items-center rounded-full border border-gray-200 px-5 text-sm font-medium text-gray-700 dark:border-white/10 dark:text-gray-300">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}
