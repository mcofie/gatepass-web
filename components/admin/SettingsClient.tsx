'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState } from 'react'

export function SettingsClient({ initialSettings, initialOrganizer }: { initialSettings: Record<string, any>, initialOrganizer: any }) {
    const supabase = createClient()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState<'platform' | 'profile' | 'team'>('profile')
    const [loading, setLoading] = useState(false)

    // Platform Settings State (Parsed from KV)
    const [settings, setSettings] = useState({
        fee_percentage: Number(initialSettings?.platform_fee_percent || 4),
        fee_fixed: Number(initialSettings?.platform_fee_fixed || 0),
        is_maintenance_mode: Boolean(initialSettings?.maintenance_mode || false),
        admin_emails: (initialSettings?.admin_emails as string[]) || ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com']
    })

    const [newAdminEmail, setNewAdminEmail] = useState('')

    // Organizer Profile State
    const [organizer, setOrganizer] = useState(initialOrganizer || {
        name: '',
        description: '',
        website: '',
        twitter: '',
        instagram: '',
        logo_url: ''
    })

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `organizers/${fileName}`

        const loadToast = toast.loading('Uploading logo...')

        try {
            const { error: uploadError } = await supabase.storage
                .from('public') // Assuming 'public' bucket exists
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('public')
                .getPublicUrl(filePath)

            setOrganizer(prev => ({ ...prev, logo_url: publicUrl }))
            toast.success('Logo uploaded!')
        } catch (error: any) {
            toast.error('Error uploading logo: ' + error.message)
        } finally {
            toast.dismiss(loadToast)
        }
    }

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Upsert Fee
            const { error: feeError } = await supabase.schema('gatepass').from('settings').upsert({
                key: 'platform_fee_percent',
                value: settings.fee_percentage,
                updated_at: new Date().toISOString()
            })
            if (feeError) throw feeError

            // Upsert Fixed Fee
            const { error: fixedError } = await supabase.schema('gatepass').from('settings').upsert({
                key: 'platform_fee_fixed',
                value: settings.fee_fixed,
                updated_at: new Date().toISOString()
            })
            if (fixedError) throw fixedError

            // Upsert Maintenance
            const { error: modeError } = await supabase.schema('gatepass').from('settings').upsert({
                key: 'maintenance_mode',
                value: settings.is_maintenance_mode,
                updated_at: new Date().toISOString()
            })
            if (modeError) throw modeError

            // Upsert Admins
            const { error: teamError } = await supabase.schema('gatepass').from('settings').upsert({
                key: 'admin_emails',
                value: settings.admin_emails,
                updated_at: new Date().toISOString()
            })
            if (teamError) throw teamError

            toast.success('Settings saved successfully')
            router.refresh()
        } catch (e: any) {
            toast.error('Error saving settings: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveOrganizer = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            let result;

            if (initialOrganizer?.id) {
                result = await supabase.schema('gatepass').from('organizers').update({
                    name: organizer.name,
                    description: organizer.description,
                    website: organizer.website,
                    twitter: organizer.twitter,
                    instagram: organizer.instagram,
                    logo_url: organizer.logo_url,
                    updated_at: new Date().toISOString() // Assuming there is updated_at
                }).eq('id', initialOrganizer.id)
            } else {
                result = await supabase.schema('gatepass').from('organizers').insert({
                    user_id: user.id,
                    name: organizer.name,
                    slug: organizer.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), // Simple slug gen
                    description: organizer.description,
                    website: organizer.website,
                    twitter: organizer.twitter,
                    instagram: organizer.instagram,
                    logo_url: organizer.logo_url
                })
            }

            const { error } = result
            if (error) throw error

            toast.success('Profile updated successfully')
            router.refresh()
        } catch (e: any) {
            toast.error('Error updating profile: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-8">Settings</h1>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl mb-8 w-fit">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                        }`}
                >
                    Organizer Profile
                </button>
                <button
                    onClick={() => setActiveTab('platform')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'platform' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                        }`}
                >
                    Platform Settings
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'team' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'
                        }`}
                >
                    Team Access
                </button>
            </div>

            {activeTab === 'platform' ? (
                <form onSubmit={handleSaveSettings} className="space-y-8 animate-fade-in">
                    {/* Fees Section */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </span>
                            Fees Configuration
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Percentage Fee (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.fee_percentage}
                                        onChange={e => setSettings({ ...settings, fee_percentage: Number(e.target.value) })}
                                        className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Taken from every ticket sale.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fixed Fee (GHS)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.fee_fixed}
                                        onChange={e => setSettings({ ...settings, fee_fixed: Number(e.target.value) })}
                                        className="w-full pl-3 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-500">GHS</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Additional fixed amount per ticket.</p>
                            </div>
                        </div>
                    </div>

                    {/* System Section */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="bg-gray-100 text-gray-600 p-1.5 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            </span>
                            System Controls
                        </h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-900">Maintenance Mode</p>
                                <p className="text-sm text-gray-500">Disable all public access to events.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.is_maintenance_mode}
                                    onChange={e => setSettings({ ...settings, is_maintenance_mode: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            ) : activeTab === 'team' ? (
                <div className="space-y-6 animate-fade-in max-w-xl">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold mb-4">Manage Administrators</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            These users will have full access to the dashboard.
                        </p>

                        {/* Add New */}
                        <div className="flex gap-2 mb-8">
                            <input
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                placeholder="Enter email address..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-black focus:border-black"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        if (newAdminEmail && !settings.admin_emails.includes(newAdminEmail)) {
                                            setSettings(prev => ({ ...prev, admin_emails: [...prev.admin_emails, newAdminEmail] }))
                                            setNewAdminEmail('')
                                        }
                                    }
                                }}
                            />
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    if (newAdminEmail && !settings.admin_emails.includes(newAdminEmail)) {
                                        setSettings(prev => ({ ...prev, admin_emails: [...prev.admin_emails, newAdminEmail] }))
                                        setNewAdminEmail('')
                                    }
                                }}
                                className="bg-black text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-800"
                            >
                                Add
                            </button>
                        </div>

                        {/* List */}
                        <div className="space-y-2">
                            {settings.admin_emails.map(email => (
                                <div key={email} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs font-bold border border-gray-200">
                                            {email.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{email}</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings(prev => ({ ...prev, admin_emails: prev.admin_emails.filter(e => e !== email) }))}
                                        className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveSettings}
                            disabled={loading}
                            className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? 'Saving Access...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSaveOrganizer} className="space-y-8 animate-fade-in">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                            <div className="relative group">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-gray-400 overflow-hidden border border-gray-200">
                                    {organizer.logo_url ? (
                                        <img src={organizer.logo_url} alt={organizer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        organizer.name ? organizer.name.charAt(0).toUpperCase() : '?'
                                    )}
                                </div>
                                <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Public Profile</h2>
                                <p className="text-sm text-gray-500">This information will be displayed on your event pages.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Organizer Name</label>
                            <input
                                type="text"
                                value={organizer.name || ''}
                                onChange={e => setOrganizer({ ...organizer, name: e.target.value })}
                                placeholder="e.g. Acme Events"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                            <textarea
                                value={organizer.description || ''}
                                onChange={e => setOrganizer({ ...organizer, description: e.target.value })}
                                placeholder="Tell us about yourself..."
                                rows={4}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition resize-none"
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                                <input
                                    type="url"
                                    value={organizer.website || ''}
                                    onChange={e => setOrganizer({ ...organizer, website: e.target.value })}
                                    placeholder="https://example.com"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Instagram</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400">@</span>
                                    <input
                                        type="text"
                                        value={organizer.instagram || ''}
                                        onChange={e => setOrganizer({ ...organizer, instagram: e.target.value })}
                                        placeholder="username"
                                        className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Twitter / X</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400">@</span>
                                    <input
                                        type="text"
                                        value={organizer.twitter || ''}
                                        onChange={e => setOrganizer({ ...organizer, twitter: e.target.value })}
                                        placeholder="username"
                                        className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-black focus:border-black transition"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}
