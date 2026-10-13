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

    return (
        <div>
            <div className="grid gap-2 sm:grid-cols-2">
                <a href={`/api/tickets/${ticketId}/download`} download className={`${actionBase} bg-[#111] text-white hover:bg-[#333] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]`}>
                    <Download className="size-4" aria-hidden="true" />Download PDF
                </a>
                <button type="button" onClick={handleShare} className={`${actionBase} border border-[#dedede] bg-white text-[#222] hover:border-[#aaa] dark:border-[#383838] dark:bg-[#111] dark:text-white dark:hover:bg-[#202020]`}>
                    <Share2 className="size-4" aria-hidden="true" />Share link
                </button>
            </div>
            <p className="mt-3 text-center text-[12px] leading-5 text-[#777] dark:text-[#aaa]">Anyone with the link can view this pass. Share it only with someone you trust.</p>
        </div>
    )
}
