import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Download, ScanLine } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import clsx from 'clsx'
import { toast } from 'sonner'
import { Event } from '@/types/gatepass'

interface AttendeesTabProps {
    event: Event
}

export function AttendeesTab({ event }: AttendeesTabProps) {
    const [tickets, setTickets] = useState<any[]>([])
    const [loadingTickets, setLoadingTickets] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isCheckInMode, setIsCheckInMode] = useState(false)
    const [ticketPage, setTicketPage] = useState(0)
    const [ticketCount, setTicketCount] = useState(0)
    const TICKETS_PER_PAGE = 20

    const supabase = createClient()

    const fetchTickets = async (page = 0) => {
        setLoadingTickets(true)
        const from = page * TICKETS_PER_PAGE
        const to = from + TICKETS_PER_PAGE - 1

        let query = supabase
            .schema('gatepass')
            .from('tickets')
            .select(`
                id, status, order_reference, created_at,
                ticket_tiers ( name, price, currency ),
                reservations ( guest_name, guest_email ),
                profiles ( full_name, id, email )
            `, { count: 'exact' })
            .eq('event_id', event.id)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (searchQuery) {
            query = query.ilike('profiles.full_name', `%${searchQuery}%`)
        }

        const { data, count } = await query

        if (data) {
            setTickets(data)
            setTicketCount(count || 0)
        }
        setLoadingTickets(false)
    }

    useEffect(() => {
        fetchTickets(ticketPage)
    }, [ticketPage, searchQuery])

    const updateTicketStatus = async (ticketId: string, status: string) => {
        if (!confirm(`Mark as ${status}?`)) return
        const { error } = await supabase.schema('gatepass').from('tickets').update({ status }).eq('id', ticketId)
        if (error) toast.error(error.message)
        else {
            await fetchTickets(ticketPage)
            toast.success(`Ticket marked as ${status}`)
        }
    }

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-gray-900">Guest List</h3>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search details..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setTicketPage(0) // Reset page on search
                            }}
                            className="pl-9 pr-4 py-1.5 w-64 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-gray-900"
                        />
                    </div>
                    <button
                        onClick={() => {
                            const csv = generateCSV(tickets)
                            downloadCSV(csv, `${event.slug}-guests.csv`)
                        }}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={() => setIsCheckInMode(!isCheckInMode)}
                        className={clsx("flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all border", {
                            'bg-green-500 text-white border-green-600 shadow-md shadow-green-500/20': isCheckInMode,
                            'bg-white text-gray-700 border-gray-200 hover:bg-gray-50': !isCheckInMode
                        })}
                    >
                        <ScanLine className="w-4 h-4" />
                        {isCheckInMode ? 'Check-in Mode' : 'Check-in'}
                    </button>
                </div>
            </div>

            {loadingTickets ? (
                <div className="p-12 text-center text-gray-500 animate-pulse">Loading guest list...</div>
            ) : tickets.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Reference</th>
                                <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Guest</th>
                                <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Ticket</th>
                                <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Purchased</th>
                                <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                                <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {tickets.map((ticket: any) => (
                                <tr key={ticket.id} className={clsx("hover:bg-gray-50/80 transition-colors group", {
                                    'opacity-40 grayscale': isCheckInMode && ticket.status !== 'valid'
                                })}>
                                    <td className="px-8 py-5 font-mono text-xs text-gray-500">{ticket.order_reference?.substring(0, 8) || 'N/A'}</td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 border border-white shadow-sm ring-1 ring-gray-100">
                                                {ticket.profiles?.full_name?.charAt(0) || ticket.reservations?.guest_name?.charAt(0) || 'G'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 group-hover:text-black transition-colors">
                                                    {ticket.profiles?.full_name || ticket.reservations?.guest_name || 'Guest User'}
                                                </div>
                                                <div className="text-xs text-gray-400 tracking-tight">
                                                    {ticket.profiles?.email || ticket.reservations?.guest_email || 'No Email'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-100">
                                            {ticket.ticket_tiers?.name}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs text-gray-500 font-medium">
                                            {new Date(ticket.created_at).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold", {
                                            'bg-green-100/80 text-green-700': ticket.status === 'valid',
                                            'bg-gray-100/80 text-gray-600': ticket.status === 'used',
                                            'bg-blue-100/80 text-blue-700': ticket.status === 'checked_in',
                                            'bg-red-100/80 text-red-700': ticket.status === 'cancelled'
                                        })}>
                                            <span className={clsx("w-1.5 h-1.5 rounded-full", {
                                                'bg-green-500': ticket.status === 'valid',
                                                'bg-gray-400': ticket.status === 'used',
                                                'bg-blue-500': ticket.status === 'checked_in',
                                                'bg-red-500': ticket.status === 'cancelled'
                                            })}></span>
                                            {(ticket.status === 'checked_in' ? 'Checked In' : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1))}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        {ticket.status === 'valid' && (
                                            <button
                                                onClick={() => updateTicketStatus(ticket.id, 'checked_in')}
                                                className={clsx("font-bold bg-black text-white rounded-lg hover:bg-gray-800 transition-all shadow-md shadow-black/10 hover:shadow-lg hover:-translate-y-0.5", {
                                                    'px-6 py-3 text-sm w-full': isCheckInMode,
                                                    'px-4 py-2 text-xs': !isCheckInMode
                                                })}
                                            >
                                                Check In
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-24 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                    </div>
                    <h3 className="text-gray-900 font-bold text-lg mb-2">No tickets sold yet</h3>
                    <p className="text-gray-500">When people purchase tickets, they will appear here.</p>
                </div>
            )}

            {/* Pagination Footer */}
            {tickets.length > 0 && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/30 flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">
                        Showing <span className="font-bold text-gray-900">{ticketPage * TICKETS_PER_PAGE + 1}</span> to <span className="font-bold text-gray-900">{Math.min((ticketPage + 1) * TICKETS_PER_PAGE, ticketCount)}</span> of <span className="font-bold text-gray-900">{ticketCount}</span> results
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTicketPage(p => Math.max(0, p - 1))}
                            disabled={ticketPage === 0 || loadingTickets}
                            className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setTicketPage(p => p + 1)}
                            disabled={(ticketPage + 1) * TICKETS_PER_PAGE >= ticketCount || loadingTickets}
                            className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
