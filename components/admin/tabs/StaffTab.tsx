import React from 'react'
import { Plus, Mail, Copy, Trash2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { EventStaff } from '@/types/gatepass'
import { createEventStaff, deleteEventStaff, fetchEventStaff } from '@/utils/actions/staff'

interface StaffTabProps {
    eventId: string
}

export function StaffTab({ eventId }: StaffTabProps) {
    const [staff, setStaff] = React.useState<EventStaff[]>([])
    const [staffForm, setStaffForm] = React.useState({ name: '', email: '' })
    const [creatingStaff, setCreatingStaff] = React.useState(false)

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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Invite Form */}
                <div className="md:col-span-1 border border-gray-100 rounded-3xl p-6 bg-white shadow-sm h-fit">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900">Invite Staff</h3>
                    </div>
                    <form onSubmit={handleAddStaff} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Staff Name</label>
                            <input
                                value={staffForm.name}
                                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all text-gray-900"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                            <input
                                type="email"
                                value={staffForm.email}
                                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                                className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-black outline-none transition-all text-gray-900"
                                placeholder="john@example.com"
                            />
                        </div>
                        <button
                            disabled={creatingStaff}
                            className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                        >
                            {creatingStaff ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" /> Send Access Code
                                </>
                            )}
                        </button>
                        <p className="text-xs text-center text-gray-400 mt-2">
                            They will receive an email with a unique code to log in to the Check-in App.
                        </p>
                    </form>
                </div>

                {/* Staff List */}
                <div className="md:col-span-2">
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-xl text-gray-900">Active Staff</h3>
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                                {staff.length} Members
                            </span>
                        </div>
                        {staff.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {staff
                                    .sort((a, b) => (b.check_in_count || 0) - (a.check_in_count || 0))
                                    .map((member) => (
                                        <div key={member.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    {(member.check_in_count || 0) > 0 && (
                                                        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                                                            {member.check_in_count}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                                        {member.name}
                                                        {(member.check_in_count || 0) > 0 && (
                                                            <span className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-bold">
                                                                {member.check_in_count} Scans
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-sm text-gray-500">{member.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-0.5">Access Code</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="bg-black/5 px-2 py-1 rounded text-sm font-bold text-black font-mono tracking-wider">
                                                            {member.access_code}
                                                        </code>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(member.access_code)
                                                                toast.success('Code copied')
                                                            }}
                                                            className="text-gray-400 hover:text-black transition-colors"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteStaff(member.id)}
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Revoke Access"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in bg-gray-50/50 rounded-3xl border border-gray-100 border-dashed m-6">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                                    <ShieldCheck className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">No staff members yet</h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                    Invite your team members to help manage events and scan tickets.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
