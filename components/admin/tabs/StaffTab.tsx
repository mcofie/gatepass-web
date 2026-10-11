import React from 'react'
import { Plus, Mail, Copy, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { EventStaff } from '@/types/gatepass'
import { createEventStaff, deleteEventStaff, fetchEventStaff } from '@/utils/actions/staff'

interface StaffTabProps {
    eventId: string
    isStaff?: boolean
}

export function StaffTab({ eventId, isStaff = false }: StaffTabProps) {
    const [staff, setStaff] = React.useState<EventStaff[]>([])
    const [staffForm, setStaffForm] = React.useState({ name: '', email: '' })
    const [creatingStaff, setCreatingStaff] = React.useState(false)
    const [showInviteForm, setShowInviteForm] = React.useState(false)

    const fetchStaff = React.useCallback(async () => {
        const data = await fetchEventStaff(eventId)
        setStaff(data as EventStaff[])
    }, [eventId])

    React.useEffect(() => {
        fetchStaff()
    }, [fetchStaff])

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!staffForm.name || !staffForm.email) {
            toast.error('Please fill in all fields')
            return
        }

        setCreatingStaff(true)
        try {
            const result = await createEventStaff(eventId, staffForm.name, staffForm.email)
            if (result.success) {
                if (result.warning) {
                    toast.warning(result.warning)
                } else {
                    toast.success('Staff invited & access code sent!')
                }
                setStaffForm({ name: '', email: '' })
                setShowInviteForm(false)
                await fetchStaff()
            } else {
                toast.error(result.error || 'Failed to add staff')
            }
        } catch (e: any) {
            toast.error('Error: ' + e.message)
        } finally {
            setCreatingStaff(false)
        }
    }

    const handleDeleteStaff = (id: string) => {
        toast('Revoke access for this staff member?', {
            action: {
                label: 'Revoke',
                onClick: async () => {
                    const result = await deleteEventStaff(id)
                    if (result.success) {
                        toast.success('Access revoked')
                        await fetchStaff()
                    } else {
                        toast.error(result.error || 'Failed to delete')
                    }
                }
            }
        })
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">Team</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage access for staff helping with check-in.</p>
                </div>
                {!isStaff && <button type="button" onClick={() => setShowInviteForm(!showInviteForm)} aria-expanded={showInviteForm} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black">
                    {showInviteForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showInviteForm ? 'Close form' : 'Invite staff'}
                </button>}
            </div>
                {/* Invite Form - Hidden for Staff */}
                {!isStaff && showInviteForm && (
                    <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-6">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-950 dark:text-white">Invite staff member</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">They will receive an access code by email.</p>
                        </div>
                        <form onSubmit={handleAddStaff} className="space-y-4">
                            <div>
                                <label htmlFor="staff-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Name</label>
                                <input
                                    id="staff-name"
                                    required
                                    value={staffForm.name}
                                    onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-900 dark:text-white"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label htmlFor="staff-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Email address</label>
                                <input
                                    id="staff-email"
                                    required
                                    type="email"
                                    value={staffForm.email}
                                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all text-gray-900 dark:text-white"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <button
                                disabled={creatingStaff}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-white dark:text-black"
                            >
                                {creatingStaff ? (
                                    <span className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" /> Send invite
                                    </>
                                )}
                            </button>
                            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                                The code gives access to this event’s check-in app.
                            </p>
                        </form>
                    </div>
                )}

                {/* Staff List */}
                <div>
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                            <h3 className="text-base font-semibold text-gray-950 dark:text-white">Staff members</h3>
                            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                {staff.length}
                            </span>
                        </div>
                        {staff.length > 0 ? (
                            <div className="divide-y divide-gray-50 dark:divide-white/5">
                                {[...staff]
                                    .sort((a, b) => (b.check_in_count || 0) - (a.check_in_count || 0))
                                    .map((member) => (
                                        <div key={member.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                                        {member.name}
                                                        {(member.check_in_count || 0) > 0 && (
                                                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                                                {member.check_in_count} scans
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                                                <div className="text-right">
                                                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Access code</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="rounded-md bg-gray-100 px-2 py-1 font-mono text-sm font-medium text-gray-900 dark:bg-white/10 dark:text-white">
                                                            {member.access_code}
                                                        </code>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(member.access_code)
                                                                toast.success('Code copied')
                                                            }}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                                                            aria-label={`Copy access code for ${member.name}`}
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {!isStaff && (
                                                    <button
                                                        onClick={() => handleDeleteStaff(member.id)}
                                                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                                        title="Revoke Access"
                                                        aria-label={`Revoke access for ${member.name}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="px-5 py-14 text-center">
                                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">No staff members yet</h3>
                                <p className="mx-auto max-w-xs text-sm text-gray-500 dark:text-gray-400">
                                    Invite staff to help with check-in.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
        </div>
    )
}
