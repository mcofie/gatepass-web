'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Trash2, Mail, Shield, UserPlus } from 'lucide-react'
import { inviteTeamMember } from '@/app/actions/team'

type TeamMember = {
    id: string
    organization_id: string
    user_id: string | null
    email: string
    role: 'admin' | 'staff'
    created_at: string
}

export function TeamSettings({ organizer }: { organizer: any }) {
    const [loading, setLoading] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [newEmail, setNewEmail] = useState('')
    const [role, setRole] = useState<'admin' | 'staff'>('staff')

    const supabase = createClient()

    useEffect(() => {
        fetchTeam()
    }, [organizer.id])

    const fetchTeam = async () => {
        try {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('organization_team')
                .select('*')
                .eq('organization_id', organizer.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setMembers(data as TeamMember[])
        } catch (error: any) {
            console.error('Error fetching team:', error)
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviting(true)

        if (!newEmail.trim()) {
            toast.error('Please enter an email address')
            setInviting(false)
            return
        }

        try {
            // Check locally first
            if (members.some(m => m.email === newEmail.trim())) {
                throw new Error('User already invited')
            }

            const result = await inviteTeamMember(organizer.id, newEmail.trim(), role, organizer.name)

            if (result.error) {
                throw new Error(result.error)
            }

            toast.success('Invitation email sent!')
            setNewEmail('')

            // Artificial delay to allow DB propagation/re-fetch if needed, strict consistency not required here
            setTimeout(fetchTeam, 500)

        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setInviting(false)
        }
    }

    const handleRemove = (id: string, email: string) => {
        toast(`Are you sure you want to remove ${email} from the team?`, {
            action: {
                label: 'Remove',
                onClick: async () => {
                    try {
                        const { error } = await supabase
                            .schema('gatepass')
                            .from('organization_team')
                            .delete()
                            .eq('id', id)

                        if (error) throw error

                        toast.success('Team member removed')
                        setMembers(prev => prev.filter(m => m.id !== id))
                    } catch (error: any) {
                        toast.error(error.message)
                    }
                }
            }
        })
    }

    return (
        <div className="max-w-4xl space-y-8">
            {/* Invite Form */}
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Invite Team Member</h3>
                        <p className="text-sm text-gray-500">Invite staff to help manage your events.</p>
                    </div>
                </div>

                <form onSubmit={handleInvite} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-bold text-gray-900 ml-1">Email Address</label>
                        <Input
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                            placeholder="colleague@example.com"
                        />
                    </div>
                    <div className="w-40 space-y-2">
                        <label className="text-sm font-bold text-gray-900 ml-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as any)}
                            className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 font-medium"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <Button
                        type="submit"
                        disabled={inviting}
                        className="h-12 px-6 bg-black text-white font-bold rounded-xl hover:bg-gray-800"
                    >
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
                    </Button>
                </form>
            </div>

            {/* Team List */}
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6">Team Members</h3>

                <div className="space-y-4">
                    {/* Owner Card (Hardcoded visual) */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm">
                                OW
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">Owner Account</p>
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Owner</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Active</span>
                    </div>

                    {members.length === 0 && (
                        <div className="py-8 text-center text-gray-400 text-sm">
                            No team members yet. Invite someone above!
                        </div>
                    )}

                    {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors rounded-2xl border border-gray-100 group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.user_id ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                    {member.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{member.email}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{member.role}</p>
                                        {!member.user_id && (
                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Pending Invite</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleRemove(member.id, member.email)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
