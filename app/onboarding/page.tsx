'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function OnboardingPage() {
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Create Organization
            const { error } = await supabase
                .schema('gatepass')
                .from('organizers')
                .insert({
                    name,
                    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    user_id: user.id
                })

            if (error) throw error

            toast.success('Organization created successfully!')
            router.push('/dashboard')
            router.refresh() // Ensure layout updates
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setName(val)
        // Auto-generate slug from name if slug hasn't been manually touched (simple heuristic)
        if (!slug || slug === val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, val.length - 1)) {
            setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans p-6 text-foreground">
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-12 h-12 bg-primary text-primary-foreground dark:bg-white dark:text-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black/20">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-3">Setup your Organization</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Create a workspace to manage your events and team.</p>
                </div>

                <div className="bg-surface dark:bg-[#111] rounded-3xl shadow-sm border border-border p-8 md:p-10 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold ml-1">Organization Name</label>
                                <Input
                                    value={name}
                                    onChange={handleNameChange}
                                    placeholder="e.g. Acme Events"
                                    required
                                    className="h-14 text-lg font-medium transition-all rounded-xl px-4"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold ml-1">URL Slug</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 font-medium whitespace-nowrap overflow-hidden pr-2">gatepass.so/org/</span>
                                    <Input
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="acme-events"
                                        required
                                        className="h-14 text-lg font-medium transition-all rounded-xl pl-40 pr-4"
                                    />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-600 ml-1">This will be your public profile URL.</p>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !name}
                            className="w-full h-14 text-lg font-bold rounded-xl active:scale-[0.98] transition-all shadow-xl shadow-primary/10 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Creating...' : (
                                <>
                                    Get Started <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Simple Footer */}
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-600 animate-in fade-in duration-1000 delay-500">
                <p className="mb-2">&copy; {new Date().getFullYear()} GatePass Inc.</p>
                <button
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-foreground hover:underline transition-colors font-medium border-none bg-transparent cursor-pointer"
                >
                    Log out
                </button>
            </div>
        </div>
    )
}

