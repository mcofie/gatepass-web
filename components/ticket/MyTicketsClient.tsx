'use client'

import { useState } from 'react'
import { Ticket, InstalmentReservation } from '@/types/gatepass'
import { formatDateTime, formatCurrency } from '@/utils/format'
import { TransferModal } from '@/components/transfer/TransferModal'
import { Button } from '@/components/ui/Button'
import { Share2, QrCode, Calendar, MapPin, Ticket as TicketIcon, Globe, Video, Eye, ChevronDown } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import QRCode from 'react-qr-code'
import Image from 'next/image'

interface MyTicketsClientProps {
    tickets: Ticket[]
    instalments?: InstalmentReservation[]
}

export function MyTicketsClient({ tickets, instalments = [] }: MyTicketsClientProps) {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [isTransferring, setIsTransferring] = useState(false)
    const [showQR, setShowQR] = useState(false)

    // Filter, Sort and Pagination state
    const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'past'>('all')
    const [sortBy, setSortBy] = useState<'event-asc' | 'event-desc' | 'purchase-desc' | 'purchase-asc'>('event-asc')
    const [currentPage, setCurrentPage] = useState(1)

    // Group by Event
    const safeInstalments = instalments || []
    const safeTickets = tickets || []
    interface GroupedEvent {
        event: {
            id: string
            title: string
            poster_url?: string | null
            starts_at: string
            venue_name: string
            primary_color?: string | null
        }
        tickets: Ticket[]
        instalments: InstalmentReservation[]
    }

    const groupedItems = [...safeTickets, ...safeInstalments].reduce((acc, item) => {
        // Both `tickets` and `instalment_reservations` tables have `reservation_id` columns now.
        // We can distinguish an instalment by checking for `amount_paid` instead.
        const isInstalment = 'amount_paid' in item
        const event = isInstalment ? (item as InstalmentReservation).reservations?.events : (item as Ticket).events
        if (!event) return acc
        const eventId = event.id

        if (!acc[eventId]) {
            acc[eventId] = {
                event: event,
                tickets: [],
                instalments: []
            }
        }

        if (isInstalment) {
            acc[eventId].instalments.push(item as InstalmentReservation)
        } else {
            acc[eventId].tickets.push(item as Ticket)
        }

        return acc
    }, {} as Record<string, GroupedEvent>)

    const handleTransfer = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setIsTransferring(true)
    }

    const handleViewQR = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setShowQR(true)
    }

    const now = new Date()

    // Filter groups
    const filteredGroups = Object.values(groupedItems).filter(group => {
        const eventDate = new Date(group.event.starts_at)
        if (activeFilter === 'upcoming') {
            return eventDate >= now
        } else if (activeFilter === 'past') {
            return eventDate < now
        }
        return true
    })

    // Sort groups
    const sortedGroups = filteredGroups.sort((a, b) => {
        if (sortBy === 'event-asc') {
            return new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
        } else if (sortBy === 'event-desc') {
            return new Date(b.event.starts_at).getTime() - new Date(a.event.starts_at).getTime()
        } else {
            const getGroupPurchaseTime = (g: GroupedEvent, newest: boolean) => {
                const times = [
                    ...g.tickets.map(t => new Date(t.created_at).getTime()),
                    ...g.instalments.map(i => new Date(i.created_at).getTime())
                ]
                if (times.length === 0) return 0
                return newest ? Math.max(...times) : Math.min(...times)
            }
            const timeA = getGroupPurchaseTime(a, sortBy === 'purchase-desc')
            const timeB = getGroupPurchaseTime(b, sortBy === 'purchase-desc')
            return sortBy === 'purchase-desc' ? timeB - timeA : timeA - timeB
        }
    })

    // Paginate groups
    const ITEMS_PER_PAGE = 5
    const totalPages = Math.ceil(sortedGroups.length / ITEMS_PER_PAGE)
    const validCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages))
    const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedGroups = sortedGroups.slice(startIndex, endIndex)

    if (safeTickets.length === 0 && safeInstalments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
                <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/30 rounded-full flex items-center justify-center mb-6">
                    <TicketIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Tickets Yet</h3>
                <p className="text-gray-500 mb-8 max-w-sm">
                    You haven&apos;t purchased any tickets yet. Explore events to find your next experience.
                </p>
                <Button onClick={() => window.location.href = '/'}>
                    Explore Events
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative">
            {/* Filter and Sort Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-500/[0.03] dark:bg-white/[0.01] border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-3xl backdrop-blur-sm relative z-20 shadow-sm">
                {/* Filter Tabs */}
                <div className="flex w-full sm:w-auto p-1 bg-zinc-100/60 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/20 dark:border-zinc-800/20">
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'upcoming', label: 'Upcoming' },
                        { id: 'past', label: 'Past' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveFilter(tab.id as any)
                                setCurrentPage(1)
                            }}
                            className={`flex-1 sm:flex-initial text-center px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeFilter === tab.id
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0">Sort By</span>
                    <div className="relative flex-grow sm:flex-grow-0">
                        <select
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value as any)
                                setCurrentPage(1)
                            }}
                            className="appearance-none w-full sm:w-auto bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-200 pl-4 pr-10 py-2.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all cursor-pointer"
                        >
                            <option value="event-asc">Event Date: Soonest First</option>
                            <option value="event-desc">Event Date: Latest First</option>
                            <option value="purchase-desc">Purchase Date: Newest First</option>
                            <option value="purchase-asc">Purchase Date: Oldest First</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Event Groups List */}
            {paginatedGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[30vh] text-center p-8 bg-zinc-500/[0.02] dark:bg-white/[0.01] border border-dashed border-zinc-200 dark:border-zinc-800/50 rounded-3xl animate-in fade-in duration-300">
                    <TicketIcon className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mb-3" />
                    <h4 className="text-base font-bold mb-1">No Tickets Found</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                        There are no tickets or instalments matching the selected filter.
                    </p>
                </div>
            ) : (
                <div className="space-y-10">
                    {paginatedGroups.map(({ event, tickets, instalments }, index) => (
                        <div key={event.id} className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                            {/* Visual Divider for subsequent events */}
                            {index > 0 && (
                                <div className="border-t border-zinc-200/50 dark:border-white/5 pb-6" />
                            )}

                            <div className="flex items-center gap-4 md:gap-5">
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl relative overflow-hidden flex-shrink-0 shadow-sm border border-black/5 dark:border-white/10">
                                    {event.poster_url ? (
                                        <Image src={event.poster_url} alt={event.title} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                                            <TicketIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 min-w-0">
                                    <h2 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none truncate">{event.title}</h2>
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs md:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                                        <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" /> {formatDateTime(event.starts_at)}</span>
                                        <span className="flex items-start gap-1.5"><MapPin className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" /> <span className="break-words leading-tight">{event.venue_name}</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {tickets.map((ticket: Ticket) => {
                                    const isVirtual = ticket.ticket_tiers?.is_virtual
                                    const virtualLink = ticket.ticket_tiers?.virtual_link
                                    return (
                                        <div 
                                            key={ticket.id} 
                                            className={`group relative glass-card rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-white/[0.02] hover:-translate-y-1 transition-all duration-300 h-[280px] border ${
                                                isVirtual 
                                                    ? 'border-purple-500/30 dark:border-purple-500/30 shadow-sm shadow-purple-500/[0.02]' 
                                                    : 'border-zinc-200/60 dark:border-zinc-800/60'
                                            }`}
                                        >
                                            {/* Ticket Stub Effect: Dashed Line & Notches */}
                                            <div className={`absolute top-[72%] left-0 right-0 h-px border-t-2 border-dashed ${
                                                isVirtual 
                                                    ? 'border-purple-500/20 dark:border-purple-500/30' 
                                                    : 'border-zinc-200/60 dark:border-zinc-800/60'
                                            }`} />
                                            <div className={`absolute top-[72%] -left-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border ${
                                                isVirtual 
                                                    ? 'border-purple-500/20 dark:border-purple-500/30 dark:border-l-transparent dark:border-t-transparent border-r-transparent border-b-transparent' 
                                                    : 'border-zinc-200/60 dark:border-zinc-800/60 dark:border-l-transparent dark:border-t-transparent border-r-transparent border-b-transparent'
                                            } rotate-45 z-10`} />
                                            <div className={`absolute top-[72%] -right-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border ${
                                                isVirtual 
                                                    ? 'border-purple-500/20 dark:border-purple-500/30 dark:border-l-transparent dark:border-t-transparent border-l-transparent border-t-transparent' 
                                                    : 'border-zinc-200/60 dark:border-zinc-800/60 dark:border-l-transparent dark:border-t-transparent border-l-transparent border-t-transparent'
                                            } -rotate-45 z-10`} />

                                            {/* Upper Section: Clickable to go to Ticket pass page */}
                                            <div 
                                                onClick={() => window.location.href = `/ticket/${ticket.id}`}
                                                className="p-6 h-[72%] flex flex-col justify-between relative cursor-pointer hover:bg-zinc-50/30 dark:hover:bg-white/[0.01] transition-colors"
                                            >
                                                {/* Subtle background glow */}
                                                {isVirtual ? (
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 dark:bg-purple-500/5 rounded-bl-[100px] blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
                                                ) : (
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-500/[0.02] dark:bg-white/[0.01] rounded-bl-[100px] blur-xl pointer-events-none group-hover:bg-zinc-500/[0.04] transition-colors" />
                                                )}

                                                {/* Content */}
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="space-y-1.5 min-w-0 pr-2">
                                                            <p className={`text-[10px] font-black uppercase tracking-[0.15em] truncate ${
                                                                isVirtual 
                                                                    ? 'text-purple-600 dark:text-purple-400' 
                                                                    : 'text-zinc-400 dark:text-zinc-500'
                                                            }`}>
                                                                {ticket.ticket_tiers?.name || 'General Access'}
                                                            </p>
                                                            <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500 font-medium lowercase tracking-wide">
                                                                #{ticket.id.slice(0, 8)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {isVirtual && (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20">
                                                                    Virtual
                                                                </span>
                                                            )}
                                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                                ticket.status === 'valid'
                                                                    ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                                                                    : ticket.status === 'used'
                                                                        ? 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-white/5 dark:text-zinc-500 dark:border-white/10'
                                                                        : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                            }`}>
                                                                {ticket.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isVirtual ? (
                                                        <div className="flex items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-500/10 flex items-center justify-center shrink-0">
                                                                {virtualLink ? (
                                                                    <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                                ) : (
                                                                    <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                                                {virtualLink ? 'Livestream Link Active' : 'Livestream Link Pending'}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 flex items-center justify-center shrink-0">
                                                                <TicketIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                                                            </div>
                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                                                Standard Entry Ticket
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Lower Section: Actions */}
                                            <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-zinc-50/30 dark:bg-white/[0.01] px-3 flex items-center gap-2">
                                                {isVirtual ? (
                                                    virtualLink ? (
                                                        <Button
                                                            className="flex-1 h-10 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-500 dark:text-white dark:hover:bg-purple-600 shadow-md shadow-purple-500/10 transition-all active:scale-95 gap-1.5 whitespace-nowrap justify-center min-w-0 px-2"
                                                            onClick={() => window.open(virtualLink, '_blank')}
                                                        >
                                                            <Video size={14} />
                                                            <span className="truncate">Join Stream</span>
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            className="flex-1 h-10 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md transition-all active:scale-95 gap-1.5 whitespace-nowrap justify-center min-w-0 px-2"
                                                            onClick={() => window.location.href = `/ticket/${ticket.id}`}
                                                        >
                                                            <Eye size={14} />
                                                            <span className="truncate">Access Pass</span>
                                                        </Button>
                                                    )
                                                ) : (
                                                    <Button
                                                        className="flex-1 h-10 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md transition-all active:scale-95 gap-1.5 whitespace-nowrap justify-center min-w-0 px-2"
                                                        onClick={() => handleViewQR(ticket)}
                                                    >
                                                        <QrCode size={14} />
                                                        <span className="truncate">Show Code</span>
                                                    </Button>
                                                )}
                                                {ticket.status === 'valid' && !isVirtual && (
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 h-10 rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-all active:scale-95 bg-white dark:bg-transparent font-bold flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 px-2"
                                                        onClick={() => handleTransfer(ticket)}
                                                    >
                                                        <Share2 size={14} />
                                                        <span className="truncate">Transfer</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {instalments.map((instalment) => (
                                    <div 
                                        key={instalment.id} 
                                        className="group relative glass-card border border-amber-500/20 dark:border-amber-500/30 rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-amber-500/[0.02] hover:-translate-y-1 transition-all duration-300 h-[280px]"
                                    >
                                        {/* Ticket Stub Effect: Dashed Line & Notches */}
                                        <div className="absolute top-[72%] left-0 right-0 h-px border-t-2 border-dashed border-amber-500/20 dark:border-amber-500/30" />
                                        <div className="absolute top-[72%] -left-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-amber-500/20 dark:border-amber-500/30 dark:border-l-transparent dark:border-t-transparent border-r-transparent border-b-transparent rotate-45 z-10" />
                                        <div className="absolute top-[72%] -right-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-amber-500/20 dark:border-amber-500/30 dark:border-l-transparent dark:border-t-transparent border-l-transparent border-t-transparent -rotate-45 z-10" />

                                        {/* Upper Section: Info */}
                                        <div className="p-6 h-[72%] flex flex-col justify-between relative bg-amber-50/20 dark:bg-amber-500/[0.01]">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100px] blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
                                            {/* Content */}
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="space-y-1.5 min-w-0 pr-2">
                                                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.15em] truncate">
                                                            {instalment.reservations?.ticket_tiers?.name || 'General Access'} x{instalment.reservations?.quantity || 1}
                                                        </p>
                                                        <p className="text-xs font-mono font-medium text-zinc-400 dark:text-zinc-500 lowercase tracking-wide">
                                                            Instalment Plan: #{instalment.id.slice(0, 8)}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                                                        {instalment.status === 'active' ? 'Paying' : instalment.status}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col mt-4">
                                                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Paid Status</span>
                                                    <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
                                                        <span className="text-zinc-900 dark:text-white">{formatCurrency(instalment.amount_paid)}</span>
                                                        <span className="text-sm text-zinc-400 dark:text-zinc-500 tracking-tighter"> / {formatCurrency(instalment.total_amount)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lower Section: Actions */}
                                        <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-zinc-50/30 dark:bg-white/[0.01] px-4 flex items-center gap-2 border-t border-dashed border-amber-500/20 dark:border-amber-500/30 backdrop-blur-sm">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider leading-none mb-1">Due</p>
                                                <strong className="text-base text-zinc-900 dark:text-white font-black font-mono leading-none">
                                                    {formatCurrency(instalment.total_amount - instalment.amount_paid)}
                                                </strong>
                                            </div>
                                            <Button
                                                className="h-10 rounded-xl text-xs font-bold bg-amber-400 text-amber-950 hover:bg-amber-500 shadow-sm transition-all active:scale-95 gap-1.5 whitespace-nowrap justify-center min-w-[110px] px-4 border border-amber-500/20 shadow-amber-500/10"
                                                onClick={() => window.location.href = `/my-tickets/instalments/${instalment.id}`}
                                            >
                                                <span className="truncate">Manage</span>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-200/50 dark:border-white/5 relative z-20">
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                        Showing {startIndex + 1}–{Math.min(endIndex, sortedGroups.length)} of {sortedGroups.length} events
                    </span>
                    
                    <div className="flex items-center justify-center flex-wrap gap-1.5 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1))
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            disabled={validCurrentPage === 1}
                            className="h-9 px-3 rounded-xl border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                        >
                            Previous
                        </Button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => {
                                    setCurrentPage(page)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    validCurrentPage === page
                                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-extrabold shadow-md'
                                        : 'bg-zinc-100/40 hover:bg-zinc-100 dark:bg-zinc-900/30 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/20 dark:border-zinc-800/20'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentPage(prev => Math.min(totalPages, prev + 1))
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            disabled={validCurrentPage === totalPages}
                            className="h-9 px-3 rounded-xl border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {
                selectedTicket && (
                    <TransferModal
                        isOpen={isTransferring}
                        onClose={() => { setIsTransferring(false); setSelectedTicket(null); }}
                        ticketId={selectedTicket?.id || ''}
                        eventName={selectedTicket?.events?.title || 'Event'}
                        onTransferCreated={() => {
                            // refresh page or state? For now user can manually refresh or we can add a router refresh
                        }}
                    />
                )
            }

            <Dialog open={showQR} onOpenChange={setShowQR}>
                <DialogContent className="sm:max-w-sm flex flex-col items-center p-8">
                    <h3 className="text-lg font-bold mb-6 text-center">Scan at Entry</h3>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-inner">
                        <QRCode value={selectedTicket?.qr_code_hash || ''} size={200} />
                    </div>
                    <div className="mt-6 text-center">
                        <p className="font-bold text-lg mb-1">{selectedTicket?.events?.title}</p>
                        <p className="text-sm text-gray-500 mb-4">{selectedTicket?.ticket_tiers?.name}</p>
                        <p className="text-xs font-mono text-gray-400 bg-gray-50 dark:bg-zinc-800 px-3 py-1 rounded-full">
                            {selectedTicket?.qr_code_hash?.slice(0, 16)}...
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
