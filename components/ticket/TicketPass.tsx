'use client'

import React from 'react'
import Image from 'next/image'
import { MapPin, Calendar, Clock, User, Ticket as TicketIcon, CheckCircle2, CalendarPlus, ChevronRight } from 'lucide-react'
import { format, addHours } from 'date-fns'
import { motion } from 'framer-motion'

interface TicketPassProps {
    id?: string
    event: {
        title: string
        poster_url?: string | null
        starts_at: string
        venue_name: string
        venue_address: string
    }
    ticket: {
        id: string
        qr_code_hash?: string
        reservation_id?: string
        reservations?: {
            guest_name?: string
            profiles?: {
                full_name?: string
            }
        }
    }
    tierName?: string
    logoUrl?: string | null
    isPrint?: boolean
}

export const TicketPass = ({
    id = "ticket-pass-card",
    event,
    ticket,
    tierName = "General Admission",
    logoUrl,
    isPrint = false
}: TicketPassProps) => {
    const attendeeName = ticket.reservations?.guest_name || ticket.reservations?.profiles?.full_name || 'Guest'
    const eventDate = new Date(event.starts_at)

    // Calendar URL Generation
    const getCalendarUrl = () => {
        const start = format(eventDate, "yyyyMMdd'T'HHmmss'Z'")
        const end = format(addHours(eventDate, 4), "yyyyMMdd'T'HHmmss'Z'")
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&location=${encodeURIComponent(event.venue_name)}&dates=${start}/${end}`
    }

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qr_code_hash || ticket.id}&color=000000`

    // Animation Variants
    const container = {
        hidden: { opacity: 0, y: 30 },
        show: {
            opacity: 1,
            y: 0,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1] as any
            }
        }
    }

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    if (isPrint) {
        return (
            <div id={id} className="w-full max-w-sm p-8" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex justify-between items-center mb-8" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '20px' }}>
                    <h1 className="text-2xl font-black" style={{ color: '#000000', margin: 0 }}>{event.title}</h1>
                    {logoUrl && <Image src={logoUrl} width={50} height={50} alt="Logo" style={{ borderRadius: '8px' }} />}
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '16px' }}>
                        <Image src={qrCodeUrl} width={160} height={160} alt="QR" unoptimized style={{ mixBlendMode: 'multiply' }} />
                    </div>
                    <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#9ca3af' }}>
                        {ticket.id.toUpperCase()}
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="p-5 rounded-2xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #f3f4f6' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Attendee</p>
                        <p className="text-base font-bold" style={{ color: '#000000' }}>{attendeeName}</p>
                        <p className="text-xs font-medium" style={{ color: '#6b7280' }}>{tierName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 px-1">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Date</p>
                            <p className="text-sm font-bold" style={{ color: '#000000' }}>{format(eventDate, 'PPP')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Time</p>
                            <p className="text-sm font-bold" style={{ color: '#000000' }}>{format(eventDate, 'p')}</p>
                        </div>
                    </div>

                    <div className="px-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>Venue</p>
                        <p className="text-sm font-bold" style={{ color: '#000000' }}>{event.venue_name}</p>
                        <p className="text-xs" style={{ color: '#6b7280' }}>{event.venue_address}</p>
                    </div>
                </div>

                <div className="mt-12 pt-6 flex justify-center border-t border-gray-100" style={{ opacity: 0.3 }}>
                    <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: '#000000' }}>GatePass Digital Ticket</p>
                </div>
            </div>
        )
    }

    return (
        <motion.div
            id={id}
            variants={container}
            initial="hidden"
            animate="show"
            className="w-full max-w-sm relative group"
        >
            {/* Ambient Shadow/Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-white/10 to-white/5 rounded-[40px] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />

            <div className="relative bg-white/90 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[40px] shadow-2xl overflow-hidden">

                {/* Poster Visual Header */}
                <motion.div variants={item} className="relative h-48 w-full overflow-hidden">
                    {event.poster_url ? (
                        <Image src={event.poster_url} fill alt="" className="object-cover transform group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                        <div className="w-full h-full bg-zinc-800" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/40 to-transparent" />

                    {/* Floating Status Badge */}
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </div>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Pass Valid</span>
                    </div>

                    <div className="absolute bottom-4 left-6 right-6">
                        <h1 className="text-2xl font-black text-white leading-tight tracking-tight drop-shadow-md">{event.title}</h1>
                    </div>
                </motion.div>

                {/* Content Section */}
                <div className="p-8 pb-10 space-y-8 relative">

                    {/* Grain Texture Overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

                    {/* Attendee + Tier */}
                    <motion.div variants={item} className="flex justify-between items-center bg-zinc-100/50 dark:bg-white/5 p-4 rounded-3xl border border-black/5 dark:border-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center shadow-lg">
                                <User className="w-6 h-6 text-white dark:text-black" />
                            </div>
                            <div>
                                <p className="text-[14px] font-bold text-zinc-900 dark:text-white">{attendeeName}</p>
                                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tierName}</p>
                            </div>
                        </div>
                        {logoUrl && (
                            <div className="w-10 h-10 rounded-xl overflow-hidden opacity-80 border border-black/5 dark:border-white/10">
                                <Image src={logoUrl} width={40} height={40} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        )}
                    </motion.div>

                    {/* QR Code Deep Content */}
                    <motion.div variants={item} className="flex flex-col items-center">
                        <div className="p-1 rounded-[32px] bg-gradient-to-br from-zinc-200 via-white to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 shadow-xl">
                            <div className="bg-white p-5 rounded-[28px] overflow-hidden">
                                <Image
                                    src={qrCodeUrl}
                                    width={160}
                                    height={160}
                                    alt="QR"
                                    className="w-40 h-40 mix-blend-multiply"
                                    unoptimized
                                />
                            </div>
                        </div>
                        <div className="mt-5 text-center px-4">
                            <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.4em] mb-3">
                                {ticket.id.substring(0, 12).toUpperCase()}
                            </p>
                            <div className="bg-zinc-100 dark:bg-white/5 px-4 py-2 rounded-2xl inline-flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Entry Verified</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Timeline & Location */}
                    <motion.div variants={item} className="space-y-4 pt-2 border-t border-zinc-100 dark:border-white/5">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Time & Date</p>
                                <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">
                                    {format(eventDate, 'EEEE, MMMM d')} <span className="text-zinc-400 px-1">•</span> {format(eventDate, 'h:mm a')}
                                </p>
                            </div>
                            <a
                                href={getCalendarUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 p-2 bg-zinc-100 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-xl transition-all duration-300"
                            >
                                <CalendarPlus className="w-4 h-4" />
                            </a>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="mt-1 w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Location</p>
                                <p className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100 truncate">{event.venue_name}</p>
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{event.venue_address}</p>
                            </div>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_name + ' ' + event.venue_address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 p-2 bg-zinc-100 dark:bg-white/5 hover:bg-blue-500 hover:text-white rounded-xl transition-all duration-300"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </a>
                        </div>
                    </motion.div>
                </div>

                {/* Bottom Bar / Signal Reminder */}
                <div className="bg-zinc-900 dark:bg-black p-4 text-center">
                    <p className="text-[9px] font-bold text-zinc-500 flex items-center justify-center gap-2 uppercase tracking-widest">
                        <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                        Weak signal? Screenshot this now for entry
                        <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                    </p>
                </div>
            </div>
        </motion.div>
    )
}
