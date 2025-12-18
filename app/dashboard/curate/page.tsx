import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CurationList } from '@/components/dashboard/CurationList'

export const revalidate = 0

export default async function CurationPage() {
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    const allowedEmails = ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com']
    if (!allowedEmails.includes(user.email?.toLowerCase() || '')) {
        redirect('/dashboard')
    }

    // 2. Fetch Events
    const { data: events } = await supabase
        .schema('gatepass')
        .from('events')
        .select(`
        *,
        organizers(*)
    `)
        .order('created_at', { ascending: false })

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Curate Feed</h1>
                <p className="text-gray-500 dark:text-gray-400">Select which events appear on the global landing page.</p>
            </div>

            <CurationList initialEvents={events || []} />
        </div>
    )
}
