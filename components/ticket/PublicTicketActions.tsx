'use client'

import { Download, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface PublicTicketActionsProps {
    ticketId: string
    eventTitle: string
}

const actionBase = 'inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#080808]'

export function PublicTicketActions({ ticketId, eventTitle }: PublicTicketActionsProps) {
    const handleShare = async () => {
        const shareData = {
            title: `${eventTitle} pass`,
            text: `Event pass for ${eventTitle}`,
            url: window.location.href,
        }

        try {
            if (navigator.share) {
                await navigator.share(shareData)
            } else {
                await navigator.clipboard.writeText(shareData.url)
                toast.success('Pass link copied')
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return
            toast.error('Could not share this pass')
        }
    }

    const handleDownloadPdf = async () => {
        const element = document.getElementById('ticket-print-target')
        if (!element) {
            toast.error('Could not prepare the PDF')
            return
        }

        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ])
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                onclone: (documentClone) => documentClone.documentElement.classList.remove('dark'),
            })
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const margin = 10
            const availableWidth = pageWidth - margin * 2
            const availableHeight = pageHeight - margin * 2
            const imageData = canvas.toDataURL('image/png')
            const imageRatio = canvas.width / canvas.height
            const width = Math.min(availableWidth, availableHeight * imageRatio)
            const height = width / imageRatio

            pdf.addImage(imageData, 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height)
            pdf.save(`gatepass-${eventTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${ticketId.slice(0, 8)}.pdf`)
        } catch (error) {
            console.error('PDF generation error:', error)
            toast.error('Could not download the PDF')
        }
    }

    return (
        <div>
            <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={handleDownloadPdf} className={`${actionBase} bg-[#111] text-white hover:bg-[#333] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]`}>
                    <Download className="size-4" aria-hidden="true" />Download PDF
                </button>
                <button type="button" onClick={handleShare} className={`${actionBase} border border-[#dedede] bg-white text-[#222] hover:border-[#aaa] dark:border-[#383838] dark:bg-[#111] dark:text-white dark:hover:bg-[#202020]`}>
                    <Share2 className="size-4" aria-hidden="true" />Share link
                </button>
            </div>
            <p className="mt-3 text-center text-[12px] leading-5 text-[#777] dark:text-[#aaa]">Anyone with the link can view this pass. Share it only with someone you trust.</p>
        </div>
    )
}
