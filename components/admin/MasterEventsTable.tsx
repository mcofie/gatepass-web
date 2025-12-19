'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Event, Organizer, TicketTier } from '@/types/gatepass'
import { Eye, Star, Ban, ExternalLink, MoreHorizontal, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { calculateFees } from '@/utils/fees'
import { toast } from 'sonner'
import Link from 'next/link'

interface MasterEvent extends Event {
    organizers: Organizer
    ticket_tiers: TicketTier[]
    reservations: {
        id: string
        transactions: {
            amount: number
            status: string
        }[]
    }[]
}

interface MasterEventsTableProps {
    events: MasterEvent[]
}

export default function MasterEventsTable({ events: initialEvents }: MasterEventsTableProps) {
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
    const [events, setEvents] = useState(initialEvents)
    const [loading, setLoading] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()

    const toggleFeature = async (event: MasterEvent) => {
        const newValue = !event.is_featured
        setLoading(event.id)

        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('events')
                .update({ is_featured: newValue })
                .eq('id', event.id)

            if (error) throw error

            setEvents(events.map(e => e.id === event.id ? { ...e, is_featured: newValue } : e))
            toast.success(newValue ? 'Event Featured' : 'Event Un-featured')
            router.refresh()
        } catch (e: any) {
            toast.error('Error: ' + e.message)
        } finally {
            setLoading(null)
        }
    }

    const togglePublish = async (event: MasterEvent) => {
        const newValue = !event.is_published
        if (!newValue && !confirm('Are you sure you want to take down this event? It will be hidden from the platform.')) return

        setLoading(event.id)
        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('events')
                .update({ is_published: newValue })
                .eq('id', event.id)

            if (error) throw error

            setEvents(events.map(e => e.id === event.id ? { ...e, is_published: newValue } : e))
            toast.success(newValue ? 'Event Republished' : 'Event Taken Down')
            router.refresh()
        } catch (e: any) {
            toast.error('Error: ' + e.message)
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-200 uppercase tracking-wider text-xs font-bold border-b border-gray-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4">Event</th>
                            <th className="px-6 py-4">Organizer</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Net Revenue</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                        {events.map((event) => {
                            // Calculate Financials - Iterating through ALL transactions in ALL reservations
                            const financialData = (event.reservations || []).reduce((acc, res) => {
                                // Iterate through all transactions in this reservation
                                res.transactions?.forEach(tx => {
                                    if (tx.status !== 'success') return

                                    const bearer = event.fee_bearer || 'customer'
                                    const { platformFee, processorFee, organizerPayout } = calculateFees(tx.amount, bearer)

                                    acc.gross += tx.amount
                                    acc.platformProfits += platformFee
                                    acc.processorFees += processorFee
                                    acc.net += organizerPayout
                                })
                                return acc
                            }, { gross: 0, platformProfits: 0, processorFees: 0, net: 0 })

                            const grossSales = financialData.gross
                            const platformProfits = financialData.platformProfits
                            const netRevenue = financialData.net
                            const totalSold = event.ticket_tiers?.reduce((acc, t) => acc + t.quantity_sold, 0) || 0
                            const isExpanded = expandedEvent === event.id

                            return (
                                <React.Fragment key={event.id}>
                                    <tr className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${isExpanded ? 'bg-gray-50/50 dark:bg-white/5' : ''}`}>
                                        <td className="px-6 py-4 font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0 relative overflow-hidden">
                                                    {event.poster_url && (
                                                        <img src={event.poster_url} className="w-full h-full object-cover" alt="" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white leading-tight">{event.title}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono uppercase tracking-tighter">ID: {event.id.split('-')[0]}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-gray-900 dark:text-white font-medium">{event.organizers?.name || 'Unknown'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold">
                                            <Badge
                                                active={event.is_published}
                                                activeText="Live"
                                                inactiveText="Hidden"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-900 dark:text-white font-bold font-mono">
                                                {formatCurrency(netRevenue)}
                                            </div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">
                                                Gross: {formatCurrency(grossSales)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                                    className={`p-2 rounded-lg transition-all ${isExpanded ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg shadow-black/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                                    title="Detailed Breakdown"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                    <a href={`/events/${event.slug || event.id}`} target="_blank" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white transition" title="View Public">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => toggleFeature(event)}
                                                        className={`p-2 rounded-lg transition ${event.is_featured ? 'text-yellow-500 bg-yellow-400/10' : 'text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400'}`}
                                                    >
                                                        <Star className={`w-4 h-4 ${event.is_featured ? 'fill-current' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => togglePublish(event)}
                                                        className={`p-2 rounded-lg transition ${!event.is_published ? 'text-red-500 bg-red-400/10' : 'text-gray-400 hover:text-red-500'}`}
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    {isExpanded && (
                                        <tr className="bg-gray-50/30 dark:bg-white/[0.02]">
                                            <td colSpan={5} className="px-8 py-6 border-b border-gray-100 dark:border-white/10">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Gross Sales</p>
                                                        <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{formatCurrency(grossSales)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{totalSold} total tickets sold</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-blue-400 dark:text-blue-300 uppercase tracking-widest mb-3">Platform Profit</p>
                                                        <p className="text-xl font-bold text-blue-500 dark:text-blue-400 font-mono tracking-tighter">{formatCurrency(platformProfits)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">Processor Fees: {formatCurrency(financialData.processorFees)}</p>
                                                    </div>
                                                    <div className="md:border-l border-gray-100 dark:border-white/10 md:pl-8">
                                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3">Net Payout</p>
                                                        <p className="text-xl font-bold text-green-500 dark:text-green-400 font-mono tracking-tighter">{formatCurrency(netRevenue)}</p>
                                                        <p className="text-xs text-gray-500 mt-1">Available for Organizer</p>
                                                    </div>
                                                    <div className="flex flex-col justify-end">
                                                        <Link href={`/admin/events/${event.id}`} className="text-center w-full bg-black dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/10">
                                                            Manage Event Detailed
                                                        </Link>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {events.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                    No events found.
                </div>
            )}
        </div>
    )
}

function Badge({ active, activeText, inactiveText }: any) {
    if (active) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {activeText}
            </span>
        )
    }
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20">
            {inactiveText}
        </span>
    )
}
