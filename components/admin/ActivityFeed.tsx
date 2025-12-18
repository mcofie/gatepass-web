'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { Activity, Calendar, Tickets, Settings, Users, FileText, History } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Log {
    id: string
    action: string
    entity_type: string
    metadata: any
    created_at: string
    profiles: {
        full_name: string | null
        email: string
    } | null
}

export function ActivityFeed({ organizationId }: { organizationId: string }) {
    const [logs, setLogs] = useState<Log[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchLogs = async () => {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('activity_logs')
                .select(`
                    *,
                    profiles ( full_name, email )
                `)
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) console.error('Activity Feed Error:', error)
            if (data) setLogs(data as any)
            setLoading(false)
        }

        if (organizationId) fetchLogs()

        // Realtime subscription
        const channel = supabase
            .channel('activity_feed')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'gatepass',
                table: 'activity_logs',
                filter: `organization_id=eq.${organizationId}`
            }, (payload) => {
                // Ideally we'd fetch the profile too, but for now we'll just reload or optimize later
                // Just reloading logic for simplicity in this artifact context
                const fetchNew = async () => {
                    const { data } = await supabase.schema('gatepass').from('activity_logs').select('*, profiles(full_name, email)').eq('id', payload.new.id).single()
                    if (data) setLogs(prev => [data as any, ...prev])
                }
                fetchNew()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [organizationId])

    if (loading) return (
        <div className="space-y-6">
            <Skeleton className="h-6 w-32 bg-gray-200" />
            <div className="space-y-6 ml-3 border-l border-gray-100">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="relative pl-8">
                        <Skeleton className="absolute -left-[9px] top-1 w-5 h-5 rounded-full bg-gray-200" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4 bg-gray-200" />
                            <Skeleton className="h-3 w-1/4 bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in bg-white rounded-3xl border border-gray-100 border-dashed">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                    <History className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Activity Yet</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                    Actions performed by you and your team will appear here in real-time.
                </p>
            </div>
        )
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'event': return <Calendar className="w-4 h-4 text-blue-500" />
            case 'ticket': return <Tickets className="w-4 h-4 text-green-500" />
            case 'settings': return <Settings className="w-4 h-4 text-gray-500" />
            case 'staff': return <Users className="w-4 h-4 text-purple-500" />
            default: return <Activity className="w-4 h-4 text-gray-400" />
        }
    }

    const formatAction = (log: Log) => {
        const actor = log.profiles?.full_name || log.profiles?.email?.split('@')[0] || 'Unknown User'

        switch (log.action) {
            case 'create_event':
                return <span><span className="font-bold text-gray-900">{actor}</span> created event <span className="font-medium">"{log.metadata?.title}"</span></span>
            case 'update_event':
                return <span><span className="font-bold text-gray-900">{actor}</span> updated event <span className="font-medium">"{log.metadata?.title}"</span></span>
            case 'update_settings':
                return <span><span className="font-bold text-gray-900">{actor}</span> updated organization settings</span>
            case 'invite_staff':
                return <span><span className="font-bold text-gray-900">{actor}</span> invited <span className="font-medium">{log.metadata?.email}</span></span>
            case 'create_ticket_tier':
                return <span><span className="font-bold text-gray-900">{actor}</span> added ticket <span className="font-medium">"{log.metadata?.name}"</span></span>
            default:
                return <span><span className="font-bold text-gray-900">{actor}</span> performed {log.action.replace(/_/g, ' ')}</span>
        }
    }

    return (
        <div className="space-y-6">
            <h3 className="font-bold text-lg text-gray-900">Recent Activity</h3>
            <div className="relative border-l border-gray-100 ml-3 space-y-6">
                {logs.map((log) => (
                    <div key={log.id} className="relative pl-8">
                        <div className="absolute -left-[9px] top-1 w-5 h-5 rounded-full bg-white border border-gray-100 flex items-center justify-center">
                            {getIcon(log.entity_type)}
                        </div>
                        <div className="text-sm">
                            <p className="text-gray-600">
                                {formatAction(log)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
