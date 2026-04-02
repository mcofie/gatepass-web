'use client'

import { useState } from 'react'
import { Ticket } from '@/types/gatepass'
import { formatDateTime, formatCurrency } from '@/utils/format'
import { TransferModal } from '@/components/transfer/TransferModal'
import { Button } from '@/components/ui/Button'
import { Share2, QrCode, Download, Calendar, MapPin, Ticket as TicketIcon } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import QRCode from 'react-qr-code'
import Image from 'next/image'

interface MyTicketsClientProps {
    tickets: Ticket[]
    instalments?: any[]
}

export function MyTicketsClient({ tickets, instalments = [] }: MyTicketsClientProps) {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [isTransferring, setIsTransferring] = useState(false)
    const [showQR, setShowQR] = useState(false)

    // Group by Event
    const safeInstalments = instalments || []
    const safeTickets = tickets || []
    const groupedItems = [...safeTickets, ...safeInstalments].reduce((acc, item) => {
        // Both `tickets` and `instalment_reservations` tables have `reservation_id` columns now.
        // We can distinguish an instalment by checking for `amount_paid` instead.
        const isInstalment = 'amount_paid' in item
        const event = isInstalment ? item.reservations.events : item.events
        const eventId = event.id

        if (!acc[eventId]) {
            acc[eventId] = {
                event: event,
                tickets: [],
                instalments: []
            }
        }

        if (isInstalment) {
            acc[eventId].instalments.push(item)
        } else {
            acc[eventId].tickets.push(item)
        }

        return acc
    }, {} as Record<string, { event: any, tickets: Ticket[], instalments: any[] }>)

    const handleTransfer = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setIsTransferring(true)
    }

    const handleViewQR = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setShowQR(true)
    }

    // Sort groups by event date (soonest first)
    const sortedGroups = Object.values(groupedItems).sort((a: any, b: any) => {
        return new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
    })

    if (safeTickets.length === 0 && safeInstalments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <TicketIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Tickets Yet</h3>
                <p className="text-gray-500 mb-8 max-w-sm">
                    You haven't purchased any tickets yet. Explore events to find your next experience.
                </p>
                <Button onClick={() => window.location.href = '/'}>
                    Explore Events
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            {sortedGroups.map(({ event, tickets, instalments }: any, index) => (
                <div key={event.id} className="space-y-6">
                    {/* Visual Divider for subsequent events */}
                    {index > 0 && (
                        <div className="border-t border-gray-100 dark:border-white/5 pb-6" />
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
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                                <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {formatDateTime(event.starts_at)}</span>
                                <span className="flex items-center gap-1.5 whitespace-nowrap"><MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {event.venue_name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {tickets.map((ticket: Ticket) => (
                            <div key={ticket.id} className="group relative bg-white dark:bg-[#111] border border-gray-100 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 h-[280px]">
                                {/* Ticket Stub Effect: Dashed Line & Notches */}
                                <div className="absolute top-[72%] left-0 right-0 h-px border-t-2 border-dashed border-gray-100 dark:border-white/10" />
                                <div className="absolute top-[72%] -left-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-gray-100 dark:border-white/10 dark:border-l-transparent dark:border-t-transparent border-r-transparent border-b-transparent rotate-45 z-10" />
                                <div className="absolute top-[72%] -right-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-gray-100 dark:border-white/10 dark:border-l-transparent dark:border-t-transparent border-l-transparent border-t-transparent -rotate-45 z-10" />

                                {/* Upper Section: Info */}
                                <div className="p-6 h-[72%] flex flex-col justify-between relative">
                                    {/* Content */}
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
                                                    {ticket.ticket_tiers?.name || 'General Access'}
                                                </p>
                                                <p className="text-xs font-mono text-gray-400 font-medium lowercase tracking-wide">
                                                    #{ticket.id.slice(0, 8)}
                                                </p>
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${ticket.status === 'valid'
                                                ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                                                : ticket.status === 'used'
                                                    ? 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-500 dark:border-white/10'
                                                    : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                }`}>
                                                {ticket.status}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                                                <TicketIcon className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium">
                                                Standard Entry Ticket
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lower Section: Actions */}
                                <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-gray-50/50 dark:bg-white/[0.02] px-3 flex items-center gap-2">
                                    <Button
                                        className="flex-1 h-10 rounded-xl text-xs font-bold bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 shadow-md transition-all active:scale-95 gap-1.5 whitespace-nowrap justify-center min-w-0 px-2"
                                        onClick={() => handleViewQR(ticket)}
                                    >
                                        <QrCode size={14} />
                                        <span className="truncate">Show Code</span>
                                    </Button>
                                    {ticket.status === 'valid' && (
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-10 rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 transition-all active:scale-95 bg-white dark:bg-transparent font-bold flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 px-2"
                                            onClick={() => handleTransfer(ticket)}
                                        >
                                            <Share2 size={14} />
                                            <span className="truncate">Transfer</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {instalments.map((instalment: any) => (
                            <div key={instalment.id} className="group relative bg-white dark:bg-[#111] border border-gray-100 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 h-[280px]">
                                {/* Ticket Stub Effect: Dashed Line & Notches */}
                                <div className="absolute top-[72%] left-0 right-0 h-px border-t-2 border-dashed border-gray-100 dark:border-white/10" />
                                <div className="absolute top-[72%] -left-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-gray-100 dark:border-white/10 dark:border-l-transparent dark:border-t-transparent border-r-transparent border-b-transparent rotate-45 z-10" />
                                <div className="absolute top-[72%] -right-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-gray-100 dark:border-white/10 dark:border-l-transparent dark:border-t-transparent border-l-transparent border-t-transparent -rotate-45 z-10" />

                                {/* Upper Section: Info */}
                                <div className="p-6 h-[72%] flex flex-col justify-between relative bg-amber-50/40 dark:bg-amber-500/[0.02]">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100px] pointer-events-none" />
                                    {/* Content */}
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="space-y-1.5 min-w-0 pr-2 z-10">
                                                <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.15em] truncate">
                                                    {instalment.reservations?.ticket_tiers?.name || 'General Access'} x{instalment.reservations?.quantity || 1}
                                                </p>
                                                <p className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 lowercase tracking-wide">
                                                    Instalment Plan: #{instalment.id.slice(0, 8)}
                                                </p>
                                            </div>
                                            <div className="shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 z-10">
                                                {instalment.status === 'active' ? 'Paying' : instalment.status}
                                            </div>
                                        </div>
                                        <div className="flex flex-col mt-4 z-10 relative">
                                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Paid Status</span>
                                            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
                                                <span className="text-zinc-900 dark:text-white">{formatCurrency(instalment.amount_paid)}</span>
                                                <span className="text-sm text-gray-400 dark:text-zinc-500 tracking-tighter"> / {formatCurrency(instalment.total_amount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lower Section: Actions */}
                                <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-gray-50/50 dark:bg-[#111]/50 px-4 flex items-center gap-2 border-t border-dashed border-gray-100 dark:border-white/10 backdrop-blur-sm">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-wider leading-none mb-1">Due</p>
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
