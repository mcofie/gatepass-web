// Mirrors EventsClient (header, stats strip, filters, list rows) so the page doesn't jump when data arrives
const bone = 'animate-pulse rounded-full bg-gray-200/80 dark:bg-white/10'

export default function Loading() {
    return (
        <div className="space-y-10 pb-16" aria-busy="true" aria-label="Loading events">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className={`${bone} h-3 w-20`} />
                    <div className={`${bone} mt-3 h-9 w-40 sm:h-11`} />
                </div>
                <div className={`${bone} h-11 w-36 self-start sm:self-auto`} />
            </header>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 lg:grid-cols-4">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-5 dark:bg-[#0b0b0b] sm:p-6">
                        <div className={`${bone} h-3 w-20`} />
                        <div className={`${bone} mt-4 h-7 w-24 sm:h-8`} style={{ animationDelay: `${i * 80}ms` }} />
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex gap-1">
                        {[72, 84, 96, 64, 56].map((w, i) => <div key={i} className={`${bone} h-9`} style={{ width: w }} />)}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`${bone} h-10 flex-1 lg:w-72 lg:flex-none`} />
                        <div className={`${bone} h-10 w-[72px]`} />
                    </div>
                </div>

                <ul className="divide-y divide-gray-200 overflow-hidden rounded-3xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#0b0b0b]">
                    {[0, 1, 2, 3, 4].map(i => (
                        <li key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6" style={{ opacity: 1 - i * 0.15 }}>
                            <div className="size-14 shrink-0 animate-pulse rounded-xl bg-gray-200/80 dark:bg-white/10 sm:size-16" />
                            <div className="min-w-0 flex-1 space-y-2.5">
                                <div className={`${bone} h-4`} style={{ width: `${[52, 38, 60, 44, 48][i]}%` }} />
                                <div className={`${bone} h-3 w-1/3`} />
                            </div>
                            <div className="hidden w-36 space-y-2 md:block">
                                <div className={`${bone} h-1.5 w-full`} />
                                <div className={`${bone} h-3 w-16`} />
                            </div>
                            <div className={`${bone} hidden h-4 w-24 lg:block`} />
                            <div className="size-8 shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-white/5" />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
