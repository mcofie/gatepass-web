'use client'

import React, { useState } from 'react'
import Image from 'next/image'

interface ReceiptTicketProps {
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
        reservation_id?: string
        qr_code_hash?: string
        reservations?: {
            guest_name?: string
            profiles?: {
                full_name?: string
            }
        }
    }
    logoUrl?: string | null
    tierName?: string
    forceExpanded?: boolean
    isPrint?: boolean
}

export const ReceiptTicket = ({ id, event, ticket, logoUrl, tierName, forceExpanded = false, isPrint = false }: ReceiptTicketProps) => {
    const [isOpen, setIsOpen] = useState(false) // Collapsed by default
    const showContent = isOpen || forceExpanded

    const handleWhatsAppShare = (e: React.MouseEvent) => {
        e.stopPropagation()
        const url = `${window.location.origin}/tickets/${ticket.id}`
        const text = `Here is your ticket for ${event.title}! 🎟️`
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank')
    }

    // Colors used in inline styles for PDF safety
    const white = '#ffffff'
    const black = '#000000'
    const gray100 = '#f3f4f6'
    const gray200 = '#e5e7eb'
    const gray400 = '#9ca3af'
    const gray500 = '#6b7280'
    const zinc800 = '#27272a'
    const zinc900 = '#18181b'

    return (
        <div
            id={id}
            onClick={() => !forceExpanded && setIsOpen(!isOpen)}
            className={`w-[300px] relative transition-all duration-300 ease-in-out overflow-hidden ${isPrint ? 'rounded-xl border-[2px]' : 'rounded-[20px] cursor-pointer'}`}
            style={{
                backgroundColor: white,
                borderColor: isPrint ? '#111827' : 'transparent',
                boxShadow: isPrint ? 'none' : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
        >
            {/* Header Image (Web Only) */}
            {!isPrint && (
                <div className="w-full relative h-32" style={{ backgroundColor: gray100 }}>
                    {event.poster_url ? (
                        <Image src={event.poster_url} fill className="object-cover" alt="Event Poster" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
                            <span className="font-bold tracking-widest uppercase opacity-20" style={{ color: white }}>GatePass</span>
                        </div>
                    )}
                    {/* Gradient Overlay */}
                    <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}
                    />

                    {/* Floating Logo or Success Icon */}
                    <div className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 overflow-hidden"
                        style={{ backgroundColor: logoUrl ? white : black, borderColor: white, color: white, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        {logoUrl ? (
                            <Image src={logoUrl} width={40} height={40} className="w-full h-full object-cover" alt="Event Logo" />
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        )}
                    </div>
                </div>
            )}

            {/* Main Content Container */}
            <div className={`relative ${isPrint ? 'p-2' : 'pt-8 p-6'}`}>
                {/* Print Header (Minimal Left Aligned) */}
                {isPrint && (
                    <div className="flex flex-col items-start text-left mb-2 mx-1 mt-1">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: gray500 }}>Admit One</p>
                        <h3 className="text-[18px] font-black uppercase leading-none tracking-tight" style={{ color: '#111827' }}>{event.title}</h3>
                    </div>
                )}

                {/* Web Header (Title) */}
                {!isPrint && (
                    <div className="text-center mb-4 mt-2">
                        <h3 className="text-[16px] font-bold leading-tight mb-0.5" style={{ color: '#111827' }}>{event.title}</h3>
                        <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: gray500 }}>Official Ticket</p>
                    </div>
                )}

                {/* Dashed Line + Notches */}
                {!isPrint ? (
                    <div className="relative w-[calc(100%+3rem)] -mx-6 h-6 flex items-center justify-center my-2">
                        <div className="w-full border-t-[2px] border-dashed mx-6" style={{ borderColor: gray200 }} />
                        <div className="absolute left-[-12px] w-6 h-6 rounded-full" style={{ backgroundColor: '#f4f4f5', boxShadow: 'inset -2px 0 2px rgba(0,0,0,0.05)' }} />
                        <div className="absolute right-[-12px] w-6 h-6 rounded-full" style={{ backgroundColor: '#f4f4f5', boxShadow: 'inset 2px 0 2px rgba(0,0,0,0.05)' }} />
                    </div>
                ) : (
                    <div className="w-full border-t-[2px] border-dashed my-4 opacity-20" style={{ borderColor: '#111827' }} />
                )}

                {/* Collapsible Section */}
                <div className={isPrint ? '' : `overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ticket-content-collapsible ${showContent ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className={`pt-2 pb-4 ticket-content ${!isPrint ? 'max-h-[320px] overflow-y-auto custom-scrollbar pr-1' : ''}`}>
                        {/* Attendee Info - Cleaner for Print */}
                        <div className={`rounded-xl ${isPrint ? 'p-2 mb-3 border-none bg-transparent' : 'p-4 mb-6 border'}`}
                            style={{ backgroundColor: isPrint ? 'transparent' : '#f9fafb', borderColor: isPrint ? 'transparent' : gray100 }}>
                            <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: gray400 }}>Admit One</p>
                            <p className="text-[18px] font-bold leading-none mb-1" style={{ color: '#111827' }}>
                                {ticket.reservations?.guest_name || ticket.reservations?.profiles?.full_name || 'Guest User'}
                            </p>
                            <p className="text-[12px] font-medium" style={{ color: gray500 }}>{tierName}</p>
                        </div>

                        <div className={`grid grid-cols-2 gap-4 ${isPrint ? 'mb-3' : 'mb-6'}`}>
                            <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: gray400 }}>Date</p>
                                <p className="text-[13px] font-bold" style={{ color: '#111827' }}>
                                    {new Date(event.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: gray400 }}>Time</p>
                                <p className="text-[13px] font-bold" style={{ color: '#111827' }}>
                                    {new Date(event.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                                </p>
                            </div>
                        </div>

                        <div className={`${isPrint ? 'mb-3' : 'mb-6'}`}>
                            <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: gray400 }}>Venue</p>
                            <div style={{ color: '#111827' }}>
                                <p className={`text-[13px] font-bold ${isPrint ? 'leading-tight' : 'truncate'}`}>
                                    {event.venue_name}
                                </p>
                                <p className={`text-[11px] ${isPrint ? 'leading-tight mt-0.5' : 'truncate'}`} style={{ color: gray500 }}>{event.venue_address}</p>
                            </div>
                        </div>

                        {/* QR Code Area */}
                        <div className="flex flex-col items-center justify-center pt-2 pb-2">
                            <div className={`bg-white border-2 rounded-xl shadow-sm ${isPrint ? 'p-2' : 'p-3'}`} style={{ borderColor: '#111827' }}>
                                <Image
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.qr_code_hash}&color=000000`}
                                    alt="QR Code"
                                    width={128}
                                    height={128}
                                    className={`${isPrint ? 'w-24 h-24' : 'w-32 h-32'} object-contain mix-blend-multiply`}
                                    unoptimized
                                />
                            </div>
                            <p className="text-center text-[10px] font-mono mt-3 tracking-widest uppercase" style={{ color: gray400 }}>Scan at entry</p>
                        </div>
                        <p className="text-center text-[9px] font-mono tracking-[0.2em] mt-1" style={{ color: '#d1d5db' }}>{ticket.qr_code_hash?.substring(0, 12)}</p>

                        {!forceExpanded && !isPrint && (
                            <button
                                onClick={handleWhatsAppShare}
                                className="w-full mt-6 h-10 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                                style={{ backgroundColor: '#25D366' }}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                Send to Friend
                            </button>
                        )}

                        {/* Watermark for Print */}
                        {isPrint && (
                            <div className="flex justify-center mt-3 opacity-60">
                                <p className="text-[8px] font-medium tracking-widest uppercase" style={{ color: gray400 }}>
                                    Powered by <span className="font-bold" style={{ color: gray500 }}>GatePass</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapsed Hint */}
                {!showContent && (
                    <div className="flex flex-col items-center justify-center pt-3 pb-2 animate-pulse collapsed-hint space-y-1 opacity-60">
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: gray500 }}>Tap to view</span>
                        <svg className="w-3 h-3" fill="none" stroke={gray500} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                )}
            </div>

            {/* Scalloped Bottom */}
            <div
                className="h-4 w-full relative"
                style={{
                    backgroundColor: white,
                    background: 'radial-gradient(circle, transparent 50%, #ffffff 50%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 100%',
                    transform: 'rotate(180deg)'
                }}
            />
        </div>
    )
}
