'use client'

import React from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function OrganizationSettings({ organizer }: { organizer: any }) {
    const [loading, setLoading] = React.useState(false)
    const [name, setName] = React.useState(organizer?.name || '')
    const [website, setWebsite] = React.useState(organizer?.website || '')
    const [slug, setSlug] = React.useState(organizer?.slug || '')

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
        <div className="max-w-2xl bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h3 className="text-xl font-bold mb-6">General Information</h3>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Example Logo</label>
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-400">
                        {name?.[0]?.toUpperCase()}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Organization Name</label>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                        placeholder="My Awesome Org"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Website</label>
                    <Input
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                        placeholder="https://example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900 ml-1">Slug</label>
                    <Input
                        value={slug}
                        onChange={e => setSlug(e.target.value)}
                        className="h-12 bg-gray-50 border-gray-200 rounded-xl px-4"
                        placeholder="my-org"
                    />
                    <p className="text-xs text-gray-400 ml-1">Used for your public profile URL.</p>
                </div>

                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-12 px-8 bg-black text-white font-bold rounded-xl hover:bg-gray-800"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    )
}
