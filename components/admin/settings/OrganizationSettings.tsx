'use client'

import React from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { logActivity } from '@/app/actions/logger'
import { Loader2 } from 'lucide-react'

export function OrganizationSettings({ organizer }: { organizer: any }) {
    const [loading, setLoading] = React.useState(false)
    const [name, setName] = React.useState(organizer?.name || '')
    const [website, setWebsite] = React.useState(organizer?.website || '')
    const [slug, setSlug] = React.useState(organizer?.slug || '')
    const [description, setDescription] = React.useState(organizer?.description || '')
    const [twitter, setTwitter] = React.useState(organizer?.twitter || '')
    const [instagram, setInstagram] = React.useState(organizer?.instagram || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .update({
                    name,
                    website,
                    slug,
                    description,
                    twitter,
                    instagram
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
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Example Logo</label>
                    <div className="w-20 h-20 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 dark:text-gray-500">
                        {name?.[0]?.toUpperCase()}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Organization Name</label>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                        placeholder="My Awesome Org"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Bio</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full min-h-[100px] bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white/20 transition-all resize-y dark:text-white"
                        placeholder="Tell us about what you do..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Website</label>
                        <Input
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                            placeholder="https://example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Slug</label>
                        <Input
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
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
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                            placeholder="@username"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Instagram</label>
                        <Input
                            value={instagram}
                            onChange={e => setInstagram(e.target.value)}
                            className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                            placeholder="@username"
                        />
                    </div>
                </div>

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
            </form>
        </div>
    )
}
