'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { Field, Notice, Panel, PrimaryButton, SectionIntro, inputClass, textareaClass } from '@/components/dashboard/ui'
import { DeleteOrganizationPanel } from './DeleteOrganizationPanel'

type Organizer = {
    id: string
    name?: string | null
    slug?: string | null
    website?: string | null
    description?: string | null
    twitter?: string | null
    instagram?: string | null
    logo_url?: string | null
}

const toHandle = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function OrganizationSettings({ organizer, userRole }: { organizer: Organizer | null; userRole: string }) {
    if (!organizer) return null
    return (
        <div className="space-y-10">
            <OrganizationForm organizer={organizer} canEdit={userRole === 'Owner' || userRole === 'Admin'} />
            {userRole === 'Owner' && organizer?.id && <DeleteOrganizationPanel organizationId={organizer.id} organizationName={organizer.name ?? 'this organization'} />}
        </div>
    )
}

function OrganizationForm({ organizer, canEdit }: { organizer: Organizer; canEdit: boolean }) {
    const router = useRouter()
    const supabase = React.useMemo(() => createClient(), [])
    const [loading, setLoading] = React.useState(false)
    const [name, setName] = React.useState(organizer.name || '')
    const [slug, setSlug] = React.useState(organizer.slug || '')
    const [website, setWebsite] = React.useState(organizer.website || '')
    const [description, setDescription] = React.useState(organizer.description || '')
    const [twitter, setTwitter] = React.useState(organizer.twitter || '')
    const [instagram, setInstagram] = React.useState(organizer.instagram || '')
    const [logoUrl, setLogoUrl] = React.useState(organizer.logo_url || '')

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const handle = toHandle(slug)
            if (!name.trim()) throw new Error('Add your organization name.')
            if (!handle) throw new Error('Add a handle.')
            if (handle !== organizer.slug) {
                const { data: existing } = await supabase.schema('gatepass').from('organizers').select('id').eq('slug', handle).neq('id', organizer.id).maybeSingle()
                if (existing) throw new Error('That handle is taken. Try another one.')
            }

            const { error } = await supabase.schema('gatepass').from('organizers').update({
                name: name.trim(),
                slug: handle,
                website: website.trim() || null,
                description: description.trim() || null,
                twitter: twitter.trim().replace(/^@+/, '') || null,
                instagram: instagram.trim().replace(/^@+/, '') || null,
                logo_url: logoUrl || null,
            }).eq('id', organizer.id)
            if (error) throw error

            setSlug(handle)
            toast.success('Organization saved')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl space-y-8">
            <SectionIntro eyebrow="Organization" title="Your brand." description="Shown on your event pages, tickets and emails." />

            <form onSubmit={handleSave} className="space-y-6">
                <fieldset disabled={!canEdit} className="space-y-6">
                    <Panel title="Identity">
                        <div className="space-y-6">
                            <div className="flex items-center gap-5">
                                <div className={`size-24 shrink-0 ${!canEdit ? 'pointer-events-none' : ''}`}>
                                    <MediaUploader type="image" path={`organizers/${organizer.id}`} value={logoUrl} onChange={setLogoUrl} aspectRatio="square" compact label="Add logo" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-950 dark:text-white">Logo</p>
                                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Square works best. JPG, PNG or WebP up to 5 MB.</p>
                                </div>
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="Name" htmlFor="organization-name">
                                    <input id="organization-name" autoComplete="organization" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
                                </Field>
                                <Field label="Handle" htmlFor="organization-slug" hint="Lowercase letters, numbers and dashes.">
                                    <div className="relative">
                                        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">@</span>
                                        <input id="organization-slug" autoCapitalize="none" spellCheck={false} value={slug} onChange={e => setSlug(e.target.value)} onBlur={() => setSlug(toHandle(slug))} className={`${inputClass} pl-8`} />
                                    </div>
                                </Field>
                            </div>
                            <Field label="About" htmlFor="organization-bio" optional>
                                <textarea id="organization-bio" value={description} onChange={e => setDescription(e.target.value)} className={textareaClass} placeholder="What kind of events do you create?" />
                            </Field>
                        </div>
                    </Panel>

                    <Panel title="Links" description="Guests see these on your event pages.">
                        <div className="grid gap-5 sm:grid-cols-3">
                            <Field label="Website" htmlFor="organization-website" optional>
                                <input id="organization-website" type="url" autoComplete="url" value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} placeholder="https://" />
                            </Field>
                            <Field label="X" htmlFor="organization-x" optional>
                                <input id="organization-x" autoCapitalize="none" value={twitter} onChange={e => setTwitter(e.target.value)} className={inputClass} placeholder="@username" />
                            </Field>
                            <Field label="Instagram" htmlFor="organization-instagram" optional>
                                <input id="organization-instagram" autoCapitalize="none" value={instagram} onChange={e => setInstagram(e.target.value)} className={inputClass} placeholder="@username" />
                            </Field>
                        </div>
                    </Panel>
                </fieldset>

                {canEdit
                    ? <div className="flex justify-end"><PrimaryButton type="submit" loading={loading}>Save changes</PrimaryButton></div>
                    : <Notice>Only owners and admins can change organization details.</Notice>}
            </form>
        </div>
    )
}
