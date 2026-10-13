import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getTransferByToken } from '@/utils/actions/transfer'
import { ClaimClient } from '@/components/transfer/ClaimClient'
import { LandingHeader } from '@/components/LandingHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/utils/format'

interface ClaimPageProps {
    params: Promise<{ token: string }>
}

export const metadata = {
    title: 'Claim ticket',
    robots: { index: false },
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-svh bg-white text-[#111] dark:bg-[#080808] dark:text-white">
            <LandingHeader />
            <main className="mx-auto w-full max-w-[440px] px-4 pb-16 pt-24 sm:pt-32">{children}</main>
        </div>
    )
}

function Unavailable({ title, description }: { title: string; description: string }) {
    return (
        <Shell>
            <div className="rounded-[28px] border border-[#e5e5e5] dark:border-[#262626]">
                <EmptyState
                    illustration="ticket"
                    title={title}
                    description={description}
                    action={<Link href="/" className="inline-flex h-11 items-center rounded-full bg-[#111] px-5 text-[13px] font-semibold text-white dark:bg-white dark:text-black">Explore events</Link>}
                />
            </div>
        </Shell>
    )
}

export default async function ClaimPage({ params }: ClaimPageProps) {
    const { token } = await params
    const supabase = await createClient()
    const [{ data: { user } }, result] = await Promise.all([supabase.auth.getUser(), getTransferByToken(token)])

    if (!result.success) return <Unavailable title="Link not found" description={result.message} />

    const { transfer } = result
    if (transfer.status === 'claimed') return <Unavailable title="Already claimed" description="Someone has already claimed this ticket." />
    if (transfer.status === 'cancelled') return <Unavailable title="Transfer cancelled" description={`${transfer.senderName} cancelled this transfer. Ask them for a new link if you still need it.`} />
    if (transfer.status === 'expired') return <Unavailable title="Link expired" description={`Transfer links last 48 hours. Ask ${transfer.senderName} to send a new one.`} />
    if (user && user.id === transfer.senderId) {
        return <Unavailable title="This is your transfer" description="Send the link to the person you want to give the ticket to. You can cancel it from My tickets." />
    }

    const event = transfer.event

    return (
        <Shell>
            <p className="text-[13px] font-medium text-[#777] dark:text-[#999]">{transfer.senderName} sent you a ticket</p>
            <h1 className="mt-2 text-[clamp(2.2rem,9vw,3rem)] font-semibold leading-[1] tracking-[-0.06em]">{event?.title || 'Your ticket'}</h1>

            <div className="mt-7 overflow-hidden rounded-[28px] border border-[#e5e5e5] dark:border-[#262626]">
                <div className="relative aspect-[4/3] w-full bg-[#f1f1f1] dark:bg-[#161616]">
                    {event?.poster_url && <Image src={event.poster_url} alt="" fill sizes="440px" className="object-cover" priority />}
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                    <dl className="space-y-2.5 text-[14px]">
                        <div className="flex items-center justify-between gap-4">
                            <dt className="text-[#777] dark:text-[#999]">Ticket</dt>
                            <dd className="font-semibold">{transfer.tierName || 'General admission'}</dd>
                        </div>
                        {event?.starts_at && (
                            <div className="flex items-center justify-between gap-4">
                                <dt className="inline-flex items-center gap-1.5 text-[#777] dark:text-[#999]"><CalendarDays className="size-3.5" aria-hidden="true" />When</dt>
                                <dd className="text-right font-semibold">{formatDateTime(event.starts_at)}</dd>
                            </div>
                        )}
                        {event?.venue_name && (
                            <div className="flex items-center justify-between gap-4">
                                <dt className="inline-flex items-center gap-1.5 text-[#777] dark:text-[#999]"><MapPin className="size-3.5" aria-hidden="true" />Where</dt>
                                <dd className="truncate text-right font-semibold">{event.venue_name}</dd>
                            </div>
                        )}
                    </dl>
                    <div className="border-t border-[#eee] pt-5 dark:border-[#262626]">
                        <ClaimClient token={token} userEmail={user?.email ?? null} recipientHint={transfer.recipientHint} />
                    </div>
                </div>
            </div>
        </Shell>
    )
}
