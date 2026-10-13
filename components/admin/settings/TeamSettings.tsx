'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { inviteTeamMember, updateTeamMemberRole, resendTeamInvite } from '@/app/actions/team'
import { Field, Panel, PrimaryButton, SectionIntro, inputClass } from '@/components/dashboard/ui'

type Role = 'admin' | 'staff'

type TeamMember = {
    id: string
    organization_id: string
    user_id: string | null
    email: string
    role: Role
    created_at: string
    profiles?: { full_name: string } | null
}

const ROLE_HELP: Record<Role, string> = {
    admin: 'Everything except deleting the organization: events, payments, team.',
    staff: 'Events and guest lists. No payments, billing or team.',
}

const initials = (value: string) => value.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export function TeamSettings({ organizer }: { organizer: { id: string; name: string } }) {
    const supabase = useMemo(() => createClient(), [])
    const [inviting, setInviting] = useState(false)
    const [members, setMembers] = useState<TeamMember[] | null>(null)
    const [newEmail, setNewEmail] = useState('')
    const [role, setRole] = useState<Role>('staff')

    const loadTeam = useCallback(async (): Promise<TeamMember[]> => {
        const { data, error } = await supabase
            .schema('gatepass')
            .from('organization_team')
            .select('*, profiles(full_name)')
            .eq('organization_id', organizer.id)
            .order('created_at', { ascending: false })
        if (error) {
            console.error('Error fetching team:', error.message)
            return []
        }
        return data as TeamMember[]
    }, [supabase, organizer.id])

    const fetchTeam = useCallback(() => loadTeam().then(setMembers), [loadTeam])

    useEffect(() => {
        let active = true
        loadTeam().then(data => { if (active) setMembers(data) })
        return () => { active = false }
    }, [loadTeam])

    const handleRoleChange = async (memberId: string, nextRole: Role) => {
        setMembers(prev => prev?.map(m => (m.id === memberId ? { ...m, role: nextRole } : m)) ?? null)
        const result = await updateTeamMemberRole(memberId, nextRole, organizer.id)
        if (result.error) {
            toast.error(result.error)
            fetchTeam()
        } else {
            toast.success('Role updated')
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        const email = newEmail.trim().toLowerCase()
        if (!email) { toast.error('Enter an email address'); return }
        if (members?.some(m => m.email.toLowerCase() === email)) { toast.error('They are already on the team'); return }

        setInviting(true)
        const result = await inviteTeamMember(organizer.id, email, role, organizer.name)
        setInviting(false)
        if (result.error) { toast.error(result.error); return }

        toast.success(`Invitation sent to ${email}`)
        setNewEmail('')
        fetchTeam()
    }

    const handleRemove = (member: TeamMember) => {
        toast(`Remove ${member.profiles?.full_name || member.email} from the team?`, {
            action: {
                label: 'Remove',
                onClick: async () => {
                    const { error } = await supabase.schema('gatepass').from('organization_team').delete().eq('id', member.id)
                    if (error) { toast.error(error.message); return }
                    setMembers(prev => prev?.filter(m => m.id !== member.id) ?? null)
                    toast.success('Removed from the team')
                },
            },
        })
    }

    const handleResend = async (member: TeamMember) => {
        const result = await resendTeamInvite(organizer.id, member.email, member.role, organizer.name)
        if (result.error) toast.error(result.error)
        else toast.success(`Invitation resent to ${member.email}`)
    }

    return (
        <div className="max-w-3xl space-y-8">
            <SectionIntro eyebrow="Team" title="Run events together." description="Invite people to help with events and the door. Each person signs in with their own email." />

            <form onSubmit={handleInvite}>
                <Panel title="Invite someone">
                    <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
                        <Field label="Email" htmlFor="invite-email">
                            <input id="invite-email" type="email" autoComplete="off" value={newEmail} onChange={e => setNewEmail(e.target.value)} className={inputClass} placeholder="colleague@example.com" />
                        </Field>
                        <Field label="Role" htmlFor="invite-role">
                            <select id="invite-role" value={role} onChange={e => setRole(e.target.value as Role)} className={inputClass}>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                            </select>
                        </Field>
                        <PrimaryButton type="submit" loading={inviting}>Send invite</PrimaryButton>
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{role === 'admin' ? 'Admin' : 'Staff'}: {ROLE_HELP[role]}</p>
                </Panel>
            </form>

            <Panel title="Members" description={members ? `${members.length + 1} ${members.length === 0 ? 'person' : 'people'}, including you` : undefined}>
                <ul className="-my-3 divide-y divide-gray-100 dark:divide-white/10">
                    <li className="flex items-center gap-4 py-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-xs font-semibold text-white dark:bg-white dark:text-black">OW</span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-950 dark:text-white">Organization owner</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Full access</p>
                        </div>
                        <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">Owner</span>
                    </li>

                    {members === null && <li className="py-6 text-sm text-gray-500">Loading team…</li>}

                    {members?.map(member => {
                        const pending = !member.user_id
                        const name = member.profiles?.full_name || member.email
                        return (
                            <li key={member.id} className="group flex flex-wrap items-center gap-4 py-3">
                                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${pending ? 'border border-dashed border-gray-300 text-gray-500 dark:border-white/20 dark:text-gray-400' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200'}`}>
                                    {initials(name)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-950 dark:text-white">{name}</p>
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                        {pending ? 'Invitation pending' : member.profiles?.full_name ? member.email : 'Joined'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {pending && (
                                        <button type="button" onClick={() => handleResend(member)} className="h-8 rounded-full px-3 text-xs font-medium text-gray-700 underline-offset-4 hover:underline dark:text-gray-300">
                                            Resend
                                        </button>
                                    )}
                                    <label className="sr-only" htmlFor={`role-${member.id}`}>Role for {name}</label>
                                    <select
                                        id={`role-${member.id}`}
                                        value={member.role}
                                        disabled={pending}
                                        onChange={e => handleRoleChange(member.id, e.target.value as Role)}
                                        className="h-8 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-950 disabled:opacity-60 dark:border-white/10 dark:bg-transparent dark:text-white"
                                    >
                                        <option value="staff">Staff</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(member)}
                                        aria-label={`Remove ${name}`}
                                        className="flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
                {members?.length === 0 && <p className="pt-6 text-sm text-gray-500 dark:text-gray-400">No one else yet. Invite your first teammate above.</p>}
            </Panel>
        </div>
    )
}
