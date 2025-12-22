'use client'

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { Download, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface WrapperProps {
    ticketId: string
    eventTitle: string
}

export const PublicTicketActions = ({ ticketId, eventTitle }: WrapperProps) => {

    const handleShare = async () => {
        const url = window.location.href
        const shareData = {
            title: `Ticket: ${eventTitle}`,
            text: `Here is my ticket for ${eventTitle}! 🎟️`,
            url: url
        }

        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData)
            } else {
                await navigator.clipboard.writeText(url)
                toast.success('Link copied to clipboard')
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Share Error:', error)
                await navigator.clipboard.writeText(url)
                toast.success('Link copied to clipboard')
            }
        }
    }

    const handleDownloadPdf = async () => {
        // Try to find the print-optimized target first, fallback to the visible card
        const element = document.getElementById('ticket-print-target') || document.getElementById('ticket-pass-card')
        if (!element) return

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true // Important for external images
            })

            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a5' // Match SuccessView: A5 is better for tickets
            })

            const pdfPageWidth = pdf.internal.pageSize.getWidth()
            const pdfPageHeight = pdf.internal.pageSize.getHeight()
            const margin = 10 // 10mm margin

            const availableWidth = pdfPageWidth - (margin * 2)
            const availableHeight = pdfPageHeight - (margin * 2)

            const imgProps = pdf.getImageProperties(imgData)
            const imgRatio = imgProps.width / imgProps.height

            // Calculate dimensions to FIT within the available area (contain)
            let finalPdfWidth = availableWidth
            let finalPdfHeight = finalPdfWidth / imgRatio

            if (finalPdfHeight > availableHeight) {
                finalPdfHeight = availableHeight
                finalPdfWidth = finalPdfHeight * imgRatio
            }

            // Center the image
            const x = margin + (availableWidth - finalPdfWidth) / 2
            const y = margin + (availableHeight - finalPdfHeight) / 2 // Center vertically too if possible

            pdf.addImage(imgData, 'PNG', x, y, finalPdfWidth, finalPdfHeight)
            pdf.save(`ticket-${eventTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`)

        } catch (error: any) {
            console.error('PDF Generation Error:', error)
            alert(`Could not generate PDF: ${error.message || 'Unknown error'}. Please try again or take a screenshot.`)
        }
    }

    return (
        <div className="space-y-4 w-full">
            {/* Share - Primaryish */}
            <button
                onClick={handleShare}
                className="w-full h-14 flex items-center justify-center gap-3 font-bold bg-white dark:bg-zinc-800 text-black dark:text-white rounded-[20px] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/10 border border-white/20"
            >
                <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-white dark:text-black" />
                </div>
                Share Ticket
            </button>

            {/* PDF Download */}
            <button
                onClick={handleDownloadPdf}
                data-html2canvas-ignore="true"
                className="w-full h-12 flex items-center justify-center gap-2 font-bold text-zinc-500 hover:text-white dark:text-zinc-400 dark:hover:text-white bg-transparent transition-all active:scale-[0.98]"
            >
                <Download className="w-4 h-4" />
                Download PDF
            </button>
        </div>
    )
}
