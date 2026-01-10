'use client'

import React, { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import QRCode from 'qrcode'

interface QRCodeModalProps {
    isOpen: boolean
    onClose: () => void
    ticketId: string
    guestName: string
    ticketType: string
    eventSlug: string
}

export function QRCodeModal({ isOpen, onClose, ticketId, guestName, ticketType, eventSlug }: QRCodeModalProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (isOpen && ticketId) {
            setLoading(true)
            // Generate QR code with ticket URL
            const ticketUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/ticket/${ticketId}`

            QRCode.toDataURL(ticketUrl, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            })
                .then(url => {
                    setQrDataUrl(url)
                    setLoading(false)
                })
                .catch(err => {
                    console.error('Error generating QR code:', err)
                    setLoading(false)
                })
        }
    }, [isOpen, ticketId])

    const handleDownload = () => {
        if (!qrDataUrl) return

        const link = document.createElement('a')
        link.href = qrDataUrl
        link.download = `ticket-${ticketId.substring(0, 8)}-qr.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-[#111] rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 fade-in duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Ticket QR Code</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {guestName} • {ticketType}
                    </p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-6">
                    {loading ? (
                        <div className="w-64 h-64 bg-gray-100 dark:bg-white/10 rounded-2xl flex items-center justify-center animate-pulse">
                            <span className="text-gray-400">Generating...</span>
                        </div>
                    ) : qrDataUrl ? (
                        <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
                            <img
                                src={qrDataUrl}
                                alt="Ticket QR Code"
                                className="w-56 h-56"
                            />
                        </div>
                    ) : (
                        <div className="w-64 h-64 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center">
                            <span className="text-red-500">Failed to generate QR</span>
                        </div>
                    )}
                </div>

                {/* Ticket ID */}
                <p className="text-center text-xs text-gray-400 font-mono mb-6">
                    ID: {ticketId.substring(0, 8)}...
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleDownload}
                        disabled={!qrDataUrl}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Download QR
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
