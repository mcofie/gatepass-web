'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type AttendeeProfile = {
    full_name: string
    phone: string
    city: string
    country: string
    birthday: string
    bio: string
    interests: string[]
    dietary_needs: string
    accessibility_needs: string
    instagram: string
    x_handle: string
    share_with_organizers: boolean
}

const LIMITS: Partial<Record<keyof AttendeeProfile, number>> = {
    full_name: 120, phone: 32, city: 80, country: 80, bio: 500, dietary_needs: 200, accessibility_needs: 300, instagram: 60, x_handle: 60,
}

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const handle = (value: unknown) => clean(value, 60).replace(/^@+/, '').replace(/^https?:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com)\//i, '').replace(/\/$/, '')

export async function getMyAttendeeProfile(): Promise<AttendeeProfile | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: profile }, { data: account }] = await Promise.all([
        supabase.schema('gatepass').from('attendee_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.schema('gatepass').from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ])

    return {
        full_name: account?.full_name ?? user.user_metadata?.full_name ?? '',
        phone: profile?.phone ?? '',
        city: profile?.city ?? '',
        country: profile?.country ?? '',
        birthday: profile?.birthday ?? '',
        bio: profile?.bio ?? '',
        interests: profile?.interests ?? [],
        dietary_needs: profile?.dietary_needs ?? '',
        accessibility_needs: profile?.accessibility_needs ?? '',
        instagram: profile?.instagram ?? '',
        x_handle: profile?.x_handle ?? '',
        share_with_organizers: profile?.share_with_organizers ?? false,
    }
}

export async function saveMyAttendeeProfile(input: AttendeeProfile) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Sign in to save your profile')

    const birthday = clean(input.birthday, 10)
    if (birthday) {
        const date = new Date(`${birthday}T00:00:00Z`)
        if (Number.isNaN(date.getTime()) || date > new Date() || date.getUTCFullYear() < 1900) throw new Error('Enter a valid birthday')
    }

    const interests = [...new Set((Array.isArray(input.interests) ? input.interests : []).map(i => clean(i, 30)).filter(Boolean))].slice(0, 12)

    const { error } = await supabase.schema('gatepass').from('attendee_profiles').upsert({
        user_id: user.id,
        phone: clean(input.phone, LIMITS.phone!) || null,
        city: clean(input.city, LIMITS.city!) || null,
        country: clean(input.country, LIMITS.country!) || null,
        birthday: birthday || null,
        bio: clean(input.bio, LIMITS.bio!) || null,
        interests,
        dietary_needs: clean(input.dietary_needs, LIMITS.dietary_needs!) || null,
        accessibility_needs: clean(input.accessibility_needs, LIMITS.accessibility_needs!) || null,
        instagram: handle(input.instagram) || null,
        x_handle: handle(input.x_handle) || null,
        share_with_organizers: Boolean(input.share_with_organizers),
        updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)

    const fullName = clean(input.full_name, LIMITS.full_name!)
    if (fullName) {
        await supabase.schema('gatepass').from('profiles').update({ full_name: fullName }).eq('id', user.id)
    }

    revalidatePath('/my-tickets')
}
