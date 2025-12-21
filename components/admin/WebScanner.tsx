'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ScanLine, CheckCircle2, XCircle, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/format'

export function WebScanner({ organizationId }: { organizationId: string }) {
    const supabase = createClient()
    const [ticketId, setTicketId] = useState('')
    const [loading, setLoading] = useState(false)
    const [lastScan, setLastScan] = useState<any>(null)
    const [error, setError] = useState('')

    // Auto-focus input for USB scanners
    const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!ticketId.trim()) return

        setLoading(true)
        setError('')
        setLastScan(null)

        try {
            // 1. Fetch Ticket & Validate Org - Restricted by organizationId
            const { data: ticket, error: fetchError } = await supabase
                .schema('gatepass')
                .from('tickets')
                .select(`
                    id, 
                    status, 
                    price,
                    currency,
                    ticket_tiers (name),
                    events (title, organization_id),
                    profiles (full_name, email),
                    reservations (guest_name)
                `)
                .eq('id', ticketId.trim())
                .eq('events.organization_id', organizationId) // SECURITY: Only allow scanning tickets for THIS org
                .single()

            if (fetchError || !ticket) {
                setError('Ticket not found.')
                toast.error('Ticket not found')
                return
            }

            // 2. Check Status
            if (ticket.status === 'used') {
                setLastScan({ ...ticket, newCheckIn: false, error: 'ALREADY SCANNED' })
                toast.warning('Ticket already used!')
                return
            }

            if (ticket.status === 'cancelled') {
                setLastScan({ ...ticket, newCheckIn: false, error: 'TICKET INVALID' })
                toast.error('Ticket is cancelled')
                return
            }

            // 3. Mark as Used
            const { error: updateError } = await supabase
                .schema('gatepass')
                .from('tickets')
                .update({ status: 'used' }) // We should also track 'scanned_at' if we had the column
                .eq('id', ticket.id)

            if (updateError) throw updateError

            setLastScan({ ...ticket, newCheckIn: true })
            toast.success('Check-in Successful!')
            setTicketId('') // Clear for next scan

        } catch (e: any) {
            console.error(e)
            setError(e.message)
        } finally {
            setLoading(false)
            // Refocus for next scan
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }

    return (
        <div className="max-w-md mx-auto py-12 animate-fade-in">
            <h1 className="text-3xl font-black text-center mb-8 text-gray-900 dark:text-white">Ticket Scanner</h1>

            {/* Input Box (Acts as Scanner Target) */}
            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl mb-8">
                <form onSubmit={handleScan} className="relative">
                    <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        ref={inputRef}
                        value={ticketId}
                        onChange={(e) => setTicketId(e.target.value)}
                        placeholder="Scan or type ticket ID..."
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-mono text-lg outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:bg-white dark:focus:bg-[#111] dark:text-white transition-all uppercase"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading || !ticketId}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check In'}
                    </button>
                </form>
                <p className="text-center text-xs text-gray-400 mt-4">
                    Ready for USB scanner input or manual entry.
                </p>
            </div>

            {/* Result Display */}
            {lastScan && (
                <div className={`rounded-3xl p-8 text-center animate-scale-in border-2 ${lastScan.error ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-900 dark:text-red-200' : 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-900 dark:text-green-200'}`}>
                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${lastScan.error ? 'bg-red-100 dark:bg-red-500/20' : 'bg-green-100 dark:bg-green-500/20'}`}>
                        {lastScan.error ? <XCircle className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
                    </div>

                    <h2 className="text-3xl font-black mb-1">
                        {lastScan.error ? lastScan.error : 'VALID TICKET'}
                    </h2>
                    <p className={`font-medium mb-6 ${lastScan.error ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {lastScan.reservations?.guest_name || lastScan.profiles?.full_name || 'Guest'}
                    </p>

                    <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-4 text-left space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="opacity-70">Event</span>
                            <span className="font-bold">{lastScan.events?.title}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-70">Ticket Type</span>
                            <span className="font-bold">{lastScan.ticket_tiers?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-70">Price</span>
                            <span className="font-bold">{formatCurrency(lastScan.price, lastScan.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-70">ID</span>
                            <span className="font-mono text-xs">{lastScan.id}</span>
                        </div>
                    </div>
                </div>
            )}

            {error && !lastScan && (
                <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-300 p-4 rounded-xl text-center font-medium animate-shake border border-red-100 dark:border-red-900/30">
                    {error}
                </div>
            )}
        </div>
    )
}
