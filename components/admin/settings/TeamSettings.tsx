'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2, Trash2, Mail, Shield, UserPlus } from 'lucide-react'
import { inviteTeamMember, updateTeamMemberRole } from '@/app/actions/team'

type TeamMember = {
    id: string
    organization_id: string
    user_id: string | null
    email: string
    role: 'admin' | 'staff'
    created_at: string
    profiles?: {
        full_name: string
    } | null
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
                .select(`
                    *,
                    profiles(full_name)
                `)
                .eq('organization_id', organizer.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setMembers(data as any[])
        } catch (error: any) {
            console.error('Error fetching team:', error.message || error)
        }
    }

    const handleRoleChange = async (memberId: string, newRole: 'admin' | 'staff') => {
        // Optimistic update
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))

        try {
            const result = await updateTeamMemberRole(memberId, newRole, organizer.id)
            if (result.error) throw new Error(result.error)
            toast.success(`Role updated to ${newRole}`)
        } catch (error: any) {
            toast.error(error.message)
            fetchTeam() // Revert on error
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
            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-500">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Invite Team Member</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Invite staff to help manage your events.</p>
                    </div>
                </div>

                <form onSubmit={handleInvite} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Email Address</label>
                        <Input
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                            placeholder="colleague@example.com"
                        />
                    </div>
                    <div className="w-40 space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as any)}
                            className="w-full h-12 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 font-medium dark:text-white"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <Button
                        type="submit"
                        disabled={inviting}
                        className="h-12 px-6 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200"
                    >
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
                    </Button>
                </form>
            </div>

            {/* Team List */}
            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Team Members</h3>

                <div className="space-y-4">
                    {/* Owner Card (Hardcoded visual) */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center font-bold text-sm">
                                OW
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">Owner Account</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Owner</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-500 rounded-full text-xs font-bold">Active</span>
                    </div>

                    {members.length === 0 && (
                        <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                            No team members yet. Invite someone above!
                        </div>
                    )}

                    {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-2xl border border-gray-100 dark:border-white/10 group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${member.user_id ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                    {member.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {member.profiles?.full_name || member.email}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                            {member.profiles?.full_name ? member.email : ''}
                                        </p>

                                        {/* Editable Role Badge */}
                                        <div className="relative">
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value as 'admin' | 'staff')}
                                                disabled={!member.user_id} // Disable for pending invites
                                                className="appearance-none text-[10px] uppercase tracking-wider font-bold bg-white dark:bg-white/5 pl-2 pr-6 py-0.5 rounded border border-gray-100 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white"
                                            >
                                                <option value="staff">Staff</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-400">
                                                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                            </div>
                                        </div>

                                        {!member.user_id && (
                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-500 px-2 py-0.5 rounded-full font-bold">Pending</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleRemove(member.id, member.email)}
                                className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
