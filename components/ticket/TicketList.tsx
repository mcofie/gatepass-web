'use client'

import React from 'react'
import QRCode from 'react-qr-code'
import { Ticket } from '@/types/gatepass'
import { formatDateTime } from '@/utils/format'
import { MapPin, Calendar, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface TicketListProps {
    tickets: Ticket[]
}

export function TicketList({ tickets }: TicketListProps) {
    if (!tickets || tickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No tickets yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Your purchased tickets will appear here.</p>
                <Link href="/">
                    <button className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:scale-105 transition-transform">
                        Browse Events
                    </button>
                </Link>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tickets.map((ticket, i) => (
                <div
                    key={ticket.id}
                    className="group relative w-full aspect-[9/16] md:aspect-auto md:h-[600px] bg-white dark:bg-[#111] rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-500 hover:-translate-y-2"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    {/* Event Image / Background */}
                    <div className="absolute inset-x-0 top-0 h-[55%] animate-fade-in">
                        {ticket.events?.poster_url ? (
                            <Image
                                src={ticket.events.poster_url}
                                alt={ticket.events.title}
                                fill
                                className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black dark:to-[#111]" />
                    </div>

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col p-6 md:p-8">
                        {/* Header */}
                        <div className="flex justify-between items-start mt-4">
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-white border border-white/20">
                                {ticket.ticket_tiers?.name}
                            </span>
                        </div>

                        {/* Title Info */}
                        <div className="mt-auto mb-8 space-y-2">
                            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight shadow-black drop-shadow-lg">
                                {ticket.events?.title}
                            </h3>
                            <div className="flex items-center gap-4 text-gray-200 text-sm font-medium">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    <span>{ticket.events?.starts_at ? formatDateTime(ticket.events.starts_at) : 'Date TBD'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-300 text-sm">
                                <MapPin className="w-4 h-4" />
                                <span className="truncate max-w-[200px]">{ticket.events?.venue_name || 'Venue TBD'}</span>
                            </div>
                        </div>

                        {/* Stub / QR Section */}
                        <div className="bg-white dark:bg-black p-6 rounded-3xl shadow-xl flex flex-col items-center gap-6 relative z-10 mx-auto w-full">
                            {/* Perforations */}
                            <div className="absolute -top-3 left-0 right-0 flex justify-between px-4">
                                {/* Using mask or just CSS circles for simple punchout effect */}
                            </div>

                            <div className="w-40 h-40 bg-white p-2 border-2 border-dashed border-gray-200 dark:border-white/20 rounded-xl flex items-center justify-center">
                                <QRCode
                                    value={ticket.qr_code_hash}
                                    size={144}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>

                            <div className="text-center space-y-1">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Ticket ID</p>
                                <p className="font-mono text-xs text-gray-600 dark:text-gray-300">{ticket.id.slice(0, 8)}</p>
                            </div>

                            <Link href={`/ticket/${ticket.id}`} className="w-full">
                                <button className="w-full py-3 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2">
                                    Full Details <ExternalLink className="w-3 h-3" />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
