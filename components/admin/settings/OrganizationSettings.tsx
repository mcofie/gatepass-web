'use client'

import React from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { logActivity } from '@/app/actions/logger'
import { Loader2 } from 'lucide-react'
import { MediaUploader } from '@/components/admin/MediaUploader'

export function OrganizationSettings({ organizer, userRole }: { organizer: any, userRole: string }) {
    if (!organizer) return null

    const [loading, setLoading] = React.useState(false)
    const canEdit = userRole === 'Owner' || userRole === 'Admin'
    const [name, setName] = React.useState(organizer?.name || '')
    const [website, setWebsite] = React.useState(organizer?.website || '')
    const [slug, setSlug] = React.useState(organizer?.slug || '')
    const [description, setDescription] = React.useState(organizer?.description || '')
    const [twitter, setTwitter] = React.useState(organizer?.twitter || '')
    const [instagram, setInstagram] = React.useState(organizer?.instagram || '')
    const [logoUrl, setLogoUrl] = React.useState(organizer?.logo_url || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Uniqueness Check for Slug
            const formattedSlug = slug.toLowerCase().trim().replace(/\s+/g, '-')
            if (formattedSlug !== organizer.slug) {
                const { data: existing } = await supabase
                    .schema('gatepass')
                    .from('organizers')
                    .select('id')
                    .eq('slug', formattedSlug)
                    .neq('id', organizer.id)
                    .single()

                if (existing) {
                    throw new Error('This slug is already taken. Please choose another one.')
                }
            }

            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .update({
                    name,
                    website,
                    slug: formattedSlug,
                    description,
                    twitter,
                    instagram,
                    logo_url: logoUrl
                })
                .eq('id', organizer.id)

            if (error) throw error
            toast.success('Organization saved')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">General Information</h3>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Organization Logo</label>
                    <div className={`w-32 ${!canEdit ? 'pointer-events-none opacity-80' : ''}`}>
                        <MediaUploader
                            type="image"
                            path={`organizers/${organizer.id}`}
                            value={logoUrl}
                            onChange={(url) => setLogoUrl(url)}
                            aspectRatio="square"
                        />
                    </div>
                    {canEdit && <p className="text-[10px] text-gray-400 ml-1 italic">Professional logos help build trust with your guests.</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Organization Name</label>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        disabled={!canEdit}
                        className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                        placeholder="My Awesome Org"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Bio</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        disabled={!canEdit}
                        className="w-full min-h-[100px] bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white/20 transition-all resize-y dark:text-white disabled:opacity-50"
                        placeholder="Tell us about what you do..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Website</label>
                        <Input
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
                            disabled={!canEdit}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                            placeholder="https://example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Slug</label>
                        <Input
                            value={slug}
                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                            disabled={!canEdit}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                            placeholder="my-org"
                        />
                    </div>
                </div>


                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">X (Twitter)</label>
                        <Input
                            value={twitter}
                            onChange={e => setTwitter(e.target.value)}
                            disabled={!canEdit}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                            placeholder="@username"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Instagram</label>
                        <Input
                            value={instagram}
                            onChange={e => setInstagram(e.target.value)}
                            disabled={!canEdit}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white disabled:opacity-50"
                            placeholder="@username"
                        />
                    </div>
                </div>

                {canEdit ? (
                    <div className="pt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                ) : (
                    <div className="pt-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">
                            You are viewing this organization in read-only mode. Only Owners and Admins can modify these settings.
                        </p>
                    </div>
                )}
            </form>
        </div>
    )
}
