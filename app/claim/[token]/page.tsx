import { createClient } from '@/utils/supabase/server'
import { getTransferByToken } from '@/utils/actions/transfer'
import { ClaimClient } from '@/components/transfer/ClaimClient'
import { LandingHeader } from '@/components/LandingHeader'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Calendar, MapPin, CheckCircle, XCircle } from 'lucide-react'
import { formatDateTime } from '@/utils/format'

interface ClaimPageProps {
    params: Promise<{ token: string }>
}

export const metadata = {
    title: 'Claim Ticket | GatePass',
}

export default async function ClaimPage({ params }: ClaimPageProps) {
    const { token } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { success, transfer, message } = await getTransferByToken(token)

    if (!success || !transfer) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white flex flex-col">
                <LandingHeader />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Unavailable</h1>
                        <p className="text-gray-500">{message || 'This transfer link is invalid or has expired.'}</p>
                    </div>
                </div>
            </div>
        )
    }

    if (transfer.status !== 'pending') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white flex flex-col">
                <LandingHeader />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-gray-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Already Claimed</h1>
                        <p className="text-gray-500">This ticket has already been claimed.</p>
                    </div>
                </div>
            </div>
        )
    }

    // Prevent self-claiming
    if (user && user.id === transfer.sender_id) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white flex flex-col">
                <LandingHeader />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-8 h-8 text-amber-600" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Cannot Claim Own Ticket</h1>
                        <p className="text-gray-500">You sent this transfer. Share the link with someone else to transfer it.</p>
                    </div>
                </div>
            </div>
        )
    }

    const event = transfer.tickets?.events
    const tier = transfer.tickets?.ticket_tiers

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-20">
            <LandingHeader />

            <main className="max-w-md mx-auto px-4 pt-32">
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="relative h-48 w-full bg-gray-200">
                        {event?.poster_url && (
                            <Image src={event.poster_url} alt={event?.title || 'Event'} fill className="object-cover" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-4 left-4 text-white">
                            <h1 className="text-2xl font-bold leading-tight mb-1">{event?.title}</h1>
                            <p className="text-white/80 text-sm font-medium">{tier?.name}</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="mb-6 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                <span>{event?.starts_at ? formatDateTime(event.starts_at) : 'Date TBA'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <MapPin className="w-4 h-4" />
                                <span>{event?.venue_name || 'Venue TBA'}</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl mb-6 text-center">
                            <p className="text-sm text-gray-500 mb-1">Sent by</p>
                            <p className="font-bold text-lg">{transfer.sender_name || 'A Friend'}</p>
                        </div>

                        <ClaimClient
                            token={token}
                            isLoggedIn={!!user}
                            userEmail={user?.email}
                        />
                    </div>
                </div>
            </main>
        </div>
    )
}
