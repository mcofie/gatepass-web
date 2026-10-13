'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { logActivity } from '@/app/actions/logger'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { Field, Panel, PrimaryButton, SectionIntro, inputClass } from '@/components/dashboard/ui'

type Profile = { full_name?: string | null; username?: string | null; email?: string | null; phone_number?: string | null; avatar_url?: string | null }
type TeamInfo = { email?: string | null; organizers?: { name?: string | null } | null }

export function ProfileSettings({ profile, userRole, teamInfo }: { profile: Profile | null; userRole: string; teamInfo?: TeamInfo | null }) {
    const router = useRouter()
    const supabase = React.useMemo(() => createClient(), [])
    const [loading, setLoading] = React.useState(false)
    const [fullName, setFullName] = React.useState(profile?.full_name || '')
    const [username, setUsername] = React.useState(profile?.username || '')
    const [phone, setPhone] = React.useState(profile?.phone_number || '')
    const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url || '')
    const email = profile?.email || teamInfo?.email || ''

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase.schema('gatepass').from('profiles').upsert({
                id: user.id,
                full_name: fullName.trim(),
                username: username.trim(),
                phone_number: phone.trim(),
                avatar_url: avatarUrl,
                email,
                updated_at: new Date().toISOString(),
            })
            if (error) throw error

            await logActivity('', 'update_profile', 'profile', user.id, { full_name: fullName })
            toast.success('Profile saved')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save your profile')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl space-y-8">
            <SectionIntro
                eyebrow="My profile"
                title="How you appear."
                description="Your name and photo show to your team and on tickets you buy."
                action={<span className="self-start rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300 sm:self-auto">{userRole}{teamInfo?.organizers?.name ? ` · ${teamInfo.organizers.name}` : ''}</span>}
            />

            <form onSubmit={handleSave}>
                <Panel footer={<PrimaryButton type="submit" loading={loading}>Save profile</PrimaryButton>}>
                    <div className="space-y-7">
                        <div className="flex items-center gap-5">
                            <div className="size-24 shrink-0">
                                <MediaUploader type="image" bucket="profiles" path="avatars" value={avatarUrl} onChange={setAvatarUrl} aspectRatio="square" compact label="Add photo" className="h-full w-full" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-950 dark:text-white">Photo</p>
                                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Square, at least 400×400. JPG, PNG or WebP up to 5 MB.</p>
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Full name" htmlFor="settings-full-name">
                                <input id="settings-full-name" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Ama Mensah" />
                            </Field>
                            <Field label="Username" htmlFor="settings-username">
                                <input id="settings-username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} className={inputClass} placeholder="amamensah" />
                            </Field>
                            <Field label="Phone" htmlFor="settings-phone">
                                <input id="settings-phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+233 24 000 0000" />
                            </Field>
                            <Field label="Email" htmlFor="settings-email" hint="Your sign-in email. It can't be changed here.">
                                <input id="settings-email" value={email} disabled className={inputClass} />
                            </Field>
                        </div>
                    </div>
                </Panel>
            </form>
        </div>
    )
}
