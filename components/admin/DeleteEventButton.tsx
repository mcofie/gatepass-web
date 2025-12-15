'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

export function DeleteEventButton({ eventId }: { eventId: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return

        setLoading(true)
        try {
            const { error } = await supabase.schema('gatepass').from('events').delete().eq('id', eventId)
            if (error) throw error
            router.refresh()
        } catch (e: any) {
            toast.error('Error deleting event: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="text-gray-400 hover:text-red-600 transition p-2 disabled:opacity-50"
            title="Delete Event"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
    )
}
