'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Sparkles, ArrowRight, ArrowLeft, Globe, Twitter, Instagram, Building2, CreditCard, CheckCircle2, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MediaUploader } from '@/components/admin/MediaUploader'

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        logo_url: '',
        website: '',
        twitter: '',
        instagram: '',
        bank_name: '',
        account_number: '',
        account_name: ''
    })

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const nextStep = () => setStep(s => Math.min(s + 1, 4))
    const prevStep = () => setStep(s => Math.max(s - 1, 1))

    const updateField = (field: string, value: string) => {
        setFormData(prev => {
            const updates: any = { [field]: value }

            // Auto-generate slug from name if strictly following pattern
            if (field === 'name' && (!prev.slug || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9-]/g, ''))) {
                updates.slug = value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
            }
            // Strict slug sanitization
            if (field === 'slug') {
                updates.slug = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
            }

            return { ...prev, ...updates }
        })
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .insert({
                    user_id: user.id,
                    name: formData.name,
                    slug: formData.slug,
                    description: formData.description || null,
                    logo_url: formData.logo_url || null,
                    website: formData.website || null,
                    twitter: formData.twitter || null,
                    instagram: formData.instagram || null,
                    bank_name: formData.bank_name || null,
                    account_number: formData.account_number || null,
                    account_name: formData.account_name || null,
                })

            if (error) throw error

            toast.success('Organization created successfully!')
            router.push('/dashboard')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message)
            setLoading(false)
        }
    }

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 50 : -50,
            opacity: 0
        })
    }

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans text-foreground overflow-hidden">
            {/* Minimal Header */}
            <div className="p-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black font-bold text-xs">
                        GP
                    </div>
                </div>
                <button onClick={handleLogout} className="text-sm font-medium text-gray-500 hover:text-foreground transition-colors">
                    Log out
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                <div className="w-full max-w-xl">
                    {/* Progress */}
                    <div className="mb-12 flex items-center justify-center gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? 'w-12 bg-black dark:bg-white' : 'w-4 bg-gray-200 dark:bg-white/10'}`}
                            />
                        ))}
                    </div>

                    <AnimatePresence mode='wait' custom={1}>
                        <motion.div
                            key={step}
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="bg-surface dark:bg-[#111] rounded-3xl md:border border-border p-0 md:p-10 w-full"
                        >
                            {step === 1 && (
                                <div className="space-y-6">
                                    <div className="text-center mb-8">
                                        <h1 className="text-3xl font-black tracking-tight mb-2">Create your Organization</h1>
                                        <p className="text-gray-500 dark:text-gray-400">Let's start with the basics.</p>
                                    </div>

                                    <div className="flex justify-center mb-6">
                                        <div className="w-32 h-32">
                                            <MediaUploader
                                                type="image"
                                                aspectRatio="square"
                                                path="org-logos"
                                                value={formData.logo_url}
                                                onChange={(url) => updateField('logo_url', url)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block">Organization Name</label>
                                            <Input
                                                value={formData.name}
                                                onChange={(e) => updateField('name', e.target.value)}
                                                placeholder="e.g. Acme Events"
                                                className="h-12 text-lg"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block">Profile URL</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium whitespace-nowrap">gatepass.so/</span>
                                                <Input
                                                    value={formData.slug}
                                                    onChange={(e) => updateField('slug', e.target.value)}
                                                    placeholder="acme"
                                                    className="h-12 text-lg pl-28"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) => updateField('description', e.target.value)}
                                                placeholder="What kind of events do you host?"
                                                className="w-full min-h-[100px] p-4 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6">
                                    <div className="text-center mb-8">
                                        <h1 className="text-3xl font-black tracking-tight mb-2">Online Presence</h1>
                                        <p className="text-gray-500 dark:text-gray-400">Where can people find you?</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Website</label>
                                            <Input
                                                value={formData.website}
                                                onChange={(e) => updateField('website', e.target.value)}
                                                placeholder="https://example.com"
                                                className="h-12"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block flex items-center gap-2"><Twitter className="w-3.5 h-3.5" /> Twitter</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                                                <Input
                                                    value={formData.twitter}
                                                    onChange={(e) => updateField('twitter', e.target.value)}
                                                    placeholder="username"
                                                    className="h-12 pl-8"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block flex items-center gap-2"><Instagram className="w-3.5 h-3.5" /> Instagram</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                                                <Input
                                                    value={formData.instagram}
                                                    onChange={(e) => updateField('instagram', e.target.value)}
                                                    placeholder="username"
                                                    className="h-12 pl-8"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6">
                                    <div className="text-center mb-8">
                                        <h1 className="text-3xl font-black tracking-tight mb-2">Payout Details</h1>
                                        <p className="text-gray-500 dark:text-gray-400">Where should we send your earnings?</p>
                                    </div>

                                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 mb-6">
                                        <p className="text-xs text-center text-gray-500">
                                            This is optional. You can always set this up later in Settings.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Bank Name</label>
                                            <Input
                                                value={formData.bank_name}
                                                onChange={(e) => updateField('bank_name', e.target.value)}
                                                placeholder="e.g. Chase"
                                                className="h-12"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Account Number</label>
                                            <Input
                                                value={formData.account_number}
                                                onChange={(e) => updateField('account_number', e.target.value)}
                                                placeholder="0000 0000 0000"
                                                className="h-12"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold ml-1 mb-1.5 block">Account Name</label>
                                            <Input
                                                value={formData.account_name}
                                                onChange={(e) => updateField('account_name', e.target.value)}
                                                placeholder="Organization or Personal Name"
                                                className="h-12"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-8 text-center">
                                    <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-black tracking-tight mb-2">All Set!</h1>
                                        <p className="text-gray-500 dark:text-gray-400 text-lg">You're ready to create <strong>{formData.name}</strong>.</p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl text-left space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Name</span>
                                            <span className="font-medium">{formData.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Link</span>
                                            <span className="font-medium">gatepass.so/{formData.slug}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Bank</span>
                                            <span className="font-medium">{formData.bank_name || 'Not set'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Navigation */}
                            <div className="mt-10 flex gap-3">
                                {step > 1 && (
                                    <Button
                                        variant="outline"
                                        onClick={prevStep}
                                        className="h-12 w-14 rounded-xl flex-shrink-0"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </Button>
                                )}

                                <Button
                                    onClick={step === 4 ? handleSubmit : nextStep}
                                    disabled={step === 1 && (!formData.name || !formData.slug) || loading}
                                    className="flex-1 h-12 rounded-xl text-base font-bold shadow-lg shadow-black/5 dark:shadow-white/5"
                                >
                                    {loading ? 'Creating...' : step === 4 ? 'Create Workspace' : 'Continue'}
                                    {!loading && step !== 4 && <ArrowRight className="w-4 h-4 ml-2" />}
                                </Button>
                            </div>

                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
