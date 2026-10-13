'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus } from 'lucide-react'
import { saveMyAttendeeProfile, type AttendeeProfile } from '@/app/actions/attendee-profile'
import { Field, PrimaryButton, Switch, inputClass, textareaClass } from '@/components/dashboard/ui'
import { cn } from '@/lib/utils'

const INTEREST_PRESETS = ['Music', 'Nightlife', 'Food & drink', 'Arts', 'Comedy', 'Sports', 'Tech', 'Business', 'Fashion', 'Film', 'Wellness', 'Faith', 'Gaming', 'Family']

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
    return (
        <section className="grid gap-5 border-t border-gray-200 py-8 first:border-t-0 first:pt-0 dark:border-white/10 md:grid-cols-[260px_minmax(0,1fr)] md:gap-10">
            <div>
                <p className="text-sm font-semibold tabular-nums text-gray-400">{number}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
            </div>
            <div className="min-w-0 space-y-5">{children}</div>
        </section>
    )
}

/** Details a guest can share with the organizers of events they attend. */
export function AttendeeProfileForm({ initial }: { initial: AttendeeProfile }) {
    const [profile, setProfile] = useState(initial)
    const [customInterest, setCustomInterest] = useState('')
    const [saving, setSaving] = useState(false)
    const set = <K extends keyof AttendeeProfile>(key: K, value: AttendeeProfile[K]) => setProfile(p => ({ ...p, [key]: value }))

    const toggleInterest = (interest: string) => {
        const has = profile.interests.includes(interest)
        if (!has && profile.interests.length >= 12) return toast.error('Pick up to 12 interests')
        set('interests', has ? profile.interests.filter(i => i !== interest) : [...profile.interests, interest])
    }

    const addCustom = () => {
        const value = customInterest.trim().slice(0, 30)
        if (!value) return
        if (!profile.interests.some(i => i.toLowerCase() === value.toLowerCase())) toggleInterest(value)
        setCustomInterest('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await saveMyAttendeeProfile(profile)
            toast.success('Profile saved')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save your profile')
        } finally {
            setSaving(false)
        }
    }

    const today = new Date().toISOString().slice(0, 10)
    const interestOptions = [...INTEREST_PRESETS, ...profile.interests.filter(i => !INTEREST_PRESETS.includes(i))]

    return (
        <form onSubmit={handleSubmit}>
            <Section number="01" title="About you" description="The basics, so organizers know who’s coming.">
                <Field label="Name" htmlFor="profile-name">
                    <input id="profile-name" autoComplete="name" value={profile.full_name} onChange={e => set('full_name', e.target.value)} maxLength={120} className={inputClass} />
                </Field>
                <Field label="A line about you" htmlFor="profile-bio" optional hint={`${profile.bio.length}/500`}>
                    <textarea id="profile-bio" value={profile.bio} onChange={e => set('bio', e.target.value)} maxLength={500} className={textareaClass} placeholder="e.g. Product designer, jazz fan, always up for a food festival." />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="City" htmlFor="profile-city" optional>
                        <input id="profile-city" autoComplete="address-level2" value={profile.city} onChange={e => set('city', e.target.value)} maxLength={80} className={inputClass} placeholder="Accra" />
                    </Field>
                    <Field label="Country" htmlFor="profile-country" optional>
                        <input id="profile-country" autoComplete="country-name" value={profile.country} onChange={e => set('country', e.target.value)} maxLength={80} className={inputClass} placeholder="Ghana" />
                    </Field>
                    <Field label="Birthday" htmlFor="profile-birthday" optional>
                        <input id="profile-birthday" type="date" autoComplete="bday" max={today} value={profile.birthday} onChange={e => set('birthday', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Phone" htmlFor="profile-phone" optional>
                        <input id="profile-phone" type="tel" autoComplete="tel" value={profile.phone} onChange={e => set('phone', e.target.value)} maxLength={32} className={inputClass} placeholder="+233 20 000 0000" />
                    </Field>
                </div>
            </Section>

            <Section number="02" title="What you’re into" description="Helps organizers plan line-ups and tell you about events you’ll like.">
                <div className="flex flex-wrap gap-2">
                    {interestOptions.map(interest => {
                        const selected = profile.interests.includes(interest)
                        return (
                            <button
                                key={interest}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleInterest(interest)}
                                className={cn(
                                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                                    selected ? 'border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-200 text-gray-700 hover:border-gray-400 dark:border-white/15 dark:text-gray-300 dark:hover:border-white/40',
                                )}
                            >
                                {selected && <Check className="size-3.5" aria-hidden="true" />}
                                {interest}
                            </button>
                        )
                    })}
                </div>
                <div className="flex gap-2">
                    <input
                        value={customInterest}
                        onChange={e => setCustomInterest(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                        maxLength={30}
                        aria-label="Add your own interest"
                        placeholder="Add your own"
                        className={cn(inputClass, 'max-w-xs')}
                    />
                    <button type="button" onClick={addCustom} aria-label="Add interest" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
                        <Plus className="size-4" aria-hidden="true" />
                    </button>
                </div>
            </Section>

            <Section number="03" title="Needs" description="So the venue is ready for you. Only shared if you turn sharing on below.">
                <Field label="Dietary needs" htmlFor="profile-dietary" optional>
                    <input id="profile-dietary" value={profile.dietary_needs} onChange={e => set('dietary_needs', e.target.value)} maxLength={200} className={inputClass} placeholder="e.g. Vegetarian, nut allergy" />
                </Field>
                <Field label="Accessibility" htmlFor="profile-access" optional>
                    <textarea id="profile-access" value={profile.accessibility_needs} onChange={e => set('accessibility_needs', e.target.value)} maxLength={300} className={textareaClass} placeholder="e.g. Step-free access, seating near the stage, sign language" />
                </Field>
            </Section>

            <Section number="04" title="Socials" description="Lets organizers tag you or say hello.">
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Instagram" htmlFor="profile-instagram" optional>
                        <input id="profile-instagram" value={profile.instagram} onChange={e => set('instagram', e.target.value)} maxLength={60} className={inputClass} placeholder="@handle" />
                    </Field>
                    <Field label="X" htmlFor="profile-x" optional>
                        <input id="profile-x" value={profile.x_handle} onChange={e => set('x_handle', e.target.value)} maxLength={60} className={inputClass} placeholder="@handle" />
                    </Field>
                </div>
            </Section>

            <Section number="05" title="Sharing" description="You decide. Turn it off any time.">
                <div className="flex items-start justify-between gap-4 rounded-3xl border border-gray-200 p-5 dark:border-white/10">
                    <div>
                        <label htmlFor="profile-share" className="text-[15px] font-semibold text-gray-950 dark:text-white">Share with organizers</label>
                        <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Organizers of events you have tickets for can see this profile. Your phone and birthday are only used to plan the event, never shown publicly.
                        </p>
                    </div>
                    <Switch id="profile-share" label="Share with organizers" checked={profile.share_with_organizers} onChange={v => set('share_with_organizers', v)} />
                </div>
                <div className="flex justify-end">
                    <PrimaryButton type="submit" loading={saving} className="w-full sm:w-auto">Save profile</PrimaryButton>
                </div>
            </Section>
        </form>
    )
}
