'use client'

import React from 'react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { logActivity } from '@/app/actions/logger'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { Loader2, User, Building2, ShieldCheck, Mail, ImageIcon } from 'lucide-react'

export function ProfileSettings({
    profile,
    userRole,
    teamInfo
}: {
    profile: any,
    userRole: string,
    teamInfo?: any
}) {
    const [loading, setLoading] = React.useState(false)
    const [fullName, setFullName] = React.useState(profile?.full_name || '')
    const [username, setUsername] = React.useState(profile?.username || '')
    const [email, setEmail] = React.useState(profile?.email || teamInfo?.email || '')
    const [phone, setPhone] = React.useState(profile?.phone_number || '')
    const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url || '')

    const supabase = createClient()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .schema('gatepass')
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: fullName,
                    username: username,
                    phone_number: phone,
                    avatar_url: avatarUrl,
                    email: email, // Keep email synced if possible
                    updated_at: new Date().toISOString()
                })

            if (error) throw error

            // Log Activity
            await logActivity('', 'update_profile', 'profile', user.id, { full_name: fullName })

            toast.success('Profile updated successfully')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Work Identity / Role Card (Expanded for Staff) */}
            {teamInfo && (
                <div className="bg-gradient-to-br from-black to-gray-800 dark:from-white dark:to-gray-200 text-white dark:text-black rounded-3xl p-6 shadow-xl shadow-black/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-black/5 flex items-center justify-center">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Team Member</p>
                            <h4 className="text-lg font-bold truncate max-w-[200px]">{teamInfo.organizers?.name}</h4>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 dark:bg-black/10 rounded-full border border-white/10 dark:border-black/5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold uppercase tracking-wider">{userRole}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Personal Information
                    </h3>
                    {!teamInfo && (
                        <div className="px-3 py-1 bg-gray-100 dark:bg-white/10 rounded-full border border-gray-200 dark:border-white/10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{userRole}</span>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Profile Photo</label>
                        <div className="flex items-start gap-8">
                            <div className="w-32 h-32 flex-shrink-0">
                                <MediaUploader
                                    type="image"
                                    bucket="profiles"
                                    path="avatars"
                                    value={avatarUrl}
                                    onChange={setAvatarUrl}
                                    aspectRatio="square"
                                    className="w-full h-full"
                                />
                            </div>
                            <div className="flex-1 pt-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Upload a new photo</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Recommended: Square image (1:1), at least 400x400px.
                                    Supports JPG, PNG or WebP. Max 5MB.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Full Name</label>
                            <Input
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Username</label>
                            <Input
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                placeholder="johndoe"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Phone Number</label>
                            <Input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 dark:text-white"
                                placeholder="+233..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-300 ml-1">Email Address</label>
                            <Input
                                value={email}
                                disabled
                                className="h-12 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl px-4 text-gray-500 cursor-not-allowed"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1 italic -mt-4">Email is managed by your organization or via authentication settings.</p>

                    <div className="pt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Profile Information
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
