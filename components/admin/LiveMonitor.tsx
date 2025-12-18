'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Activity, Users, Ticket, ArrowUp, Clock } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

type EventSummary = {
    id: string
    title: string
    venue_name: string
    starts_at: string
}

type CheckInLog = {
    id: string
    profile_name: string
    checked_in_at: string
    ticket_type: string
}

export function LiveMonitor() {
    const supabase = createClient()
    const [events, setEvents] = useState<EventSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedEventId, setSelectedEventId] = useState<string>('')
    const [stats, setStats] = useState({ totalSold: 0, checkedIn: 0, percent: 0 })
    const [feed, setFeed] = useState<CheckInLog[]>([])
    const [isConnected, setIsConnected] = useState(false)

    // Fetch Active Events (Last 24h + Future)
    useEffect(() => {
        const fetchEvents = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let orgId = null

            // Check if Owner
            const { data: ownerData } = await supabase.schema('gatepass').from('organizers').select('id').eq('user_id', user.id).single()
            if (ownerData) {
                orgId = ownerData.id
            } else {
                // Check if Staff
                const { data: staffData } = await supabase.schema('gatepass').from('organization_team').select('organization_id').eq('user_id', user.id).single()
                if (staffData) {
                    orgId = staffData.organization_id
                }
            }

            if (!orgId) return

            const today = new Date()
            today.setHours(today.getHours() - 24)

            const { data } = await supabase
                .schema('gatepass')
                .from('events')
                .select('id, title, venue_name, starts_at')
                .eq('organization_id', orgId)
                .gte('ends_at', today.toISOString()) // Only relevant events
                .order('starts_at', { ascending: true })

            if (data && data.length > 0) {
                setEvents(data)
                setSelectedEventId(data[0].id)
            }
            setLoading(false)
        }
        fetchEvents()
    }, [])

    // Initial Stats Fetch
    useEffect(() => {
        if (!selectedEventId) return

        const fetchInitialStats = async () => {
            // Count Sold
            const { count: sold } = await supabase
                .schema('gatepass')
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', selectedEventId)
                .neq('status', 'cancelled')

            // Count Checked In
            const { count: checked } = await supabase
                .schema('gatepass')
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', selectedEventId)
                .eq('status', 'used')

            setStats({
                totalSold: sold || 0,
                checkedIn: checked || 0,
                percent: sold ? ((checked || 0) / sold) * 100 : 0
            })

            // Fetch recent 5 check-ins
            const { data: recent } = await supabase
                .schema('gatepass')
                .from('tickets')
                .select(`id, status, ticket_tiers(name), profiles!inner(full_name), reservations(guest_name)`)
                .eq('event_id', selectedEventId)
                .eq('status', 'used')
                .limit(5)
            // .order('updated_at', { ascending: false }) // 'updated_at' might not track check-in time precisely if schema doesn't have it, assuming status change time roughly now. 
            // Wait, we don't have 'checked_in_at' column in standard schema usually. 
            // We'll rely on realtime for new ones, and just show list. 
            // If we want exact history, we need a logs table. For "Monitor", live feed is future forward.

            // Map recent check-ins
            if (recent) {
                const logs = recent.map((t: any) => ({
                    id: t.id,
                    profile_name: ((t.reservations as any)?.[0]?.guest_name || (t.reservations as any)?.guest_name) || t.profiles?.full_name || 'Guest',
                    ticket_type: t.ticket_tiers?.name,
                    checked_in_at: new Date().toISOString() // Approximate for historical load
                }))
                setFeed(logs)
            }
        }

        fetchInitialStats()

        // Realtime Subscription
        const channel = supabase
            .channel('live-check-in')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'gatepass',
                    table: 'tickets',
                    filter: `event_id=eq.${selectedEventId}`
                },
                async (payload) => {
                    if (payload.new.status === 'used' && payload.old.status !== 'used') {
                        // Logic: Fetch details for the new ID to get name
                        const { data: details } = await supabase
                            .schema('gatepass')
                            .from('tickets')
                            .select(`id, ticket_tiers(name), profiles(full_name), reservations(guest_name)`)
                            .eq('id', payload.new.id)
                            .single()

                        if (details) {
                            const d = details as any
                            const newLog: CheckInLog = {
                                id: d.id,
                                profile_name: (d.reservations?.[0]?.guest_name || d.reservations?.guest_name) || (d.profiles?.[0]?.full_name || d.profiles?.full_name) || 'Guest',
                                ticket_type: d.ticket_tiers?.[0]?.name || d.ticket_tiers?.name,
                                checked_in_at: new Date().toISOString()
                            }

                            setFeed(prev => [newLog, ...prev].slice(0, 10))
                            setStats(prev => ({
                                ...prev,
                                checkedIn: prev.checkedIn + 1,
                                percent: prev.totalSold ? ((prev.checkedIn + 1) / prev.totalSold) * 100 : 0
                            }))

                            toast('New Check-in!', {
                                description: `${newLog.profile_name} (${newLog.ticket_type})`
                            })
                        }
                    }
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED')
            })

        return () => {
            supabase.removeChannel(channel)
        }

    }, [selectedEventId])

    if (loading) {
        return (
            <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32 bg-gray-200 dark:bg-white/10" />
                        <Skeleton className="h-8 w-48 bg-gray-200 dark:bg-white/10" />
                    </div>
                    <Skeleton className="h-10 w-48 rounded-lg bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-48 rounded-3xl bg-gray-200 dark:bg-white/10" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <Skeleton className="h-8 w-32 mb-6 bg-gray-200 dark:bg-white/10" />
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-16 w-full rounded-xl bg-gray-100 dark:bg-white/5" />
                        ))}
                    </div>
                    <Skeleton className="h-40 w-full rounded-3xl bg-gray-200 dark:bg-white/10" />
                </div>
            </div>
        )
    }

    if (!selectedEventId) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
            <div className="w-20 h-20 bg-gray-50 dark:bg-white/10 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10">
                <Activity className="w-10 h-10 text-gray-300 dark:text-white/40" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Active Events</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                The Live Monitor tracks events happening in the last 24 hours or scheduled for the future. Create an event to start monitoring.
            </p>
            <a href="/dashboard/events" className="bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5">
                View All Events
            </a>
        </div>
    )

    return (
        <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                            {isConnected ? 'Live Connection Active' : 'Connecting...'}
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Live Monitor</h1>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-[#111] px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 shadow-sm">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="bg-transparent text-sm font-medium outline-none cursor-pointer dark:text-white"
                    >
                        {events.map(e => (
                            <option key={e.id} value={e.id} className="dark:bg-[#111]">{e.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Big Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-black dark:bg-[#111] text-white rounded-3xl p-8 shadow-xl relative overflow-hidden dark:border dark:border-white/10">
                    <div className="absolute top-0 right-0 p-32 bg-green-500/20 rounded-full translate-x-12 -translate-y-12 blur-3xl animate-pulse" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">In Venue</span>
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter mb-2">{stats.checkedIn}</h2>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                            <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-bold text-white">{stats.percent.toFixed(1)}%</span>
                            of ticket holders
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Ticket className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Total Sold</span>
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{stats.totalSold}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Expected attendance</p>
                </div>

                <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Check-in Velocity</span>
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white">--</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Attendees / min (Coming Soon)</p>
                </div>
            </div>

            {/* Live Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm p-6">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        Live Feed
                    </h3>

                    <div className="space-y-0">
                        {feed.map((log, i) => (
                            <div key={log.id} className={`flex items-center justify-between p-4 rounded-xl transition-all ${i === 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800' : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent border-b-gray-50 dark:border-b-white/5'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300'}`}>
                                        {log.profile_name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">{log.profile_name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{log.ticket_type}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
                                        {new Date(log.checked_in_at).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {feed.length === 0 && (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                                Waiting for check-ins...
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions / QR Scanner Link? */}
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/20 text-blue-900 dark:text-blue-100">
                        <h4 className="font-bold mb-2">Scanner App</h4>
                        <p className="text-sm opacity-80 mb-4 text-blue-800 dark:text-blue-200">Download the GatePass Admin app to scan tickets at the door.</p>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold w-full hover:bg-blue-700 transition-colors">
                            Get App Link
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
