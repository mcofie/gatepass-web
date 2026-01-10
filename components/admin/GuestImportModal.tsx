'use client'

import React, { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { TicketTier } from '@/types/gatepass'

interface GuestImportModalProps {
    isOpen: boolean
    onClose: () => void
    eventId: string
    tiers: TicketTier[]
    onImportComplete: () => void
}

interface ParsedGuest {
    name: string
    email: string
    phone?: string
    tierName?: string
    tierId?: string
    error?: string
}

export function GuestImportModal({ isOpen, onClose, eventId, tiers, onImportComplete }: GuestImportModalProps) {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
    const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([])
    const [selectedTierId, setSelectedTierId] = useState<string>('')
    const [importing, setImporting] = useState(false)
    const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 })
    const fileInputRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            parseCSV(text)
        }
        reader.readAsText(file)
    }

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
            toast.error('CSV must have headers and at least one guest')
            return
        }

        // Parse headers (first row)
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))

        // Find column indices
        const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('tier'))
        const emailIdx = headers.findIndex(h => h.includes('email'))
        const phoneIdx = headers.findIndex(h => h.includes('phone'))
        const tierIdx = headers.findIndex(h => h.includes('tier') || h.includes('ticket'))

        if (nameIdx === -1 || emailIdx === -1) {
            toast.error('CSV must have "name" and "email" columns')
            return
        }

        // Parse data rows
        const guests: ParsedGuest[] = []
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))

            const name = values[nameIdx] || ''
            const email = values[emailIdx] || ''
            const phone = phoneIdx !== -1 ? values[phoneIdx] : undefined
            const tierName = tierIdx !== -1 ? values[tierIdx] : undefined

            // Validate
            let error: string | undefined
            if (!name) error = 'Missing name'
            else if (!email) error = 'Missing email'
            else if (!email.includes('@')) error = 'Invalid email'

            // Match tier if provided
            let tierId: string | undefined
            if (tierName) {
                const matchedTier = tiers.find(t =>
                    t.name.toLowerCase() === tierName.toLowerCase()
                )
                tierId = matchedTier?.id
                if (!tierId && tierName) {
                    error = `Unknown tier: ${tierName}`
                }
            }

            guests.push({ name, email, phone, tierName, tierId, error })
        }

        setParsedGuests(guests)
        setStep('preview')
    }

    const handleImport = async () => {
        if (!selectedTierId && parsedGuests.some(g => !g.tierId)) {
            toast.error('Please select a default ticket tier')
            return
        }

        setImporting(true)
        setStep('importing')

        let success = 0
        let failed = 0

        for (const guest of parsedGuests) {
            if (guest.error) {
                failed++
                continue
            }

            const tierId = guest.tierId || selectedTierId

            try {
                // Create reservation
                const { data: reservation, error: resError } = await supabase
                    .schema('gatepass')
                    .from('reservations')
                    .insert({
                        event_id: eventId,
                        tier_id: tierId,
                        guest_name: guest.name,
                        guest_email: guest.email,
                        guest_phone: guest.phone || null,
                        status: 'completed',
                        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
                    })
                    .select()
                    .single()

                if (resError) throw resError

                // Create ticket
                const { error: ticketError } = await supabase
                    .schema('gatepass')
                    .from('tickets')
                    .insert({
                        event_id: eventId,
                        tier_id: tierId,
                        reservation_id: reservation.id,
                        status: 'valid',
                        order_reference: `IMPORT-${Date.now()}-${Math.random().toString(36).substring(7)}`
                    })

                if (ticketError) throw ticketError

                success++
            } catch (e) {
                failed++
            }
        }

        setImportResults({ success, failed })
        setImporting(false)
        setStep('done')
    }

    const handleClose = () => {
        setStep('upload')
        setParsedGuests([])
        setSelectedTierId('')
        setImportResults({ success: 0, failed: 0 })
        onClose()
        if (importResults.success > 0) {
            onImportComplete()
        }
    }

    if (!isOpen) return null

    const validGuests = parsedGuests.filter(g => !g.error)
    const invalidGuests = parsedGuests.filter(g => g.error)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white dark:bg-[#111] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-white/10 rounded-xl">
                            <FileSpreadsheet className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Import Guests from CSV</h3>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {step === 'upload' && (
                        <div className="text-center py-12">
                            <div
                                className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-12 hover:border-gray-300 dark:hover:border-white/20 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-900 dark:text-white font-bold mb-2">Drop CSV file here or click to upload</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    CSV should have columns: name, email, phone (optional), tier (optional)
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="flex gap-4">
                                <div className="flex-1 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validGuests.length}</p>
                                    <p className="text-sm text-green-600/80 dark:text-green-400/80">Valid guests</p>
                                </div>
                                {invalidGuests.length > 0 && (
                                    <div className="flex-1 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl">
                                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{invalidGuests.length}</p>
                                        <p className="text-sm text-red-600/80 dark:text-red-400/80">Invalid rows</p>
                                    </div>
                                )}
                            </div>

                            {/* Default tier selector */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Default Ticket Tier
                                </label>
                                <select
                                    value={selectedTierId}
                                    onChange={(e) => setSelectedTierId(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white"
                                >
                                    <option value="">Select a tier...</option>
                                    {tiers.map(tier => (
                                        <option key={tier.id} value={tier.id}>{tier.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Used for guests without a tier column</p>
                            </div>

                            {/* Preview table */}
                            <div className="border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-white/5">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Email</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {parsedGuests.slice(0, 10).map((guest, i) => (
                                            <tr key={i} className={guest.error ? 'bg-red-50/50 dark:bg-red-500/5' : ''}>
                                                <td className="px-4 py-3 text-gray-900 dark:text-white">{guest.name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-500">{guest.email || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {guest.error ? (
                                                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                                            <AlertCircle className="w-3 h-3" /> {guest.error}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                            <CheckCircle2 className="w-3 h-3" /> Ready
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedGuests.length > 10 && (
                                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-white/5">
                                        + {parsedGuests.length - 10} more rows
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <Loader2 className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
                            <p className="text-gray-900 dark:text-white font-bold">Importing guests...</p>
                            <p className="text-sm text-gray-500">This may take a moment</p>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="text-center py-12">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">Import Complete!</p>
                            <p className="text-gray-500 mb-4">
                                {importResults.success} guests imported successfully
                                {importResults.failed > 0 && `, ${importResults.failed} failed`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
                        <button
                            onClick={() => setStep('upload')}
                            className="px-6 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={validGuests.length === 0 || (!selectedTierId && parsedGuests.some(g => !g.tierId))}
                            className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                        >
                            Import {validGuests.length} Guests
                        </button>
                    </div>
                )}

                {step === 'done' && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex justify-end">
                        <button
                            onClick={handleClose}
                            className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
