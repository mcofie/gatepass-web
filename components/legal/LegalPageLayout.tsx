import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'

type LegalPage = 'terms' | 'privacy'

const pages: { key: LegalPage; label: string; href: string }[] = [
    { key: 'terms', label: 'Terms of Service', href: '/terms-of-service' },
    { key: 'privacy', label: 'Privacy Policy', href: '/privacy-policy' },
]

export function LegalPageLayout({
    activePage,
    title,
    introduction,
    children,
}: {
    activePage: LegalPage
    title: string
    introduction: string
    children: ReactNode
}) {
    return (
        <div className="flex min-h-svh flex-col bg-white text-[#111] dark:bg-[#080808] dark:text-white">
            <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
                <Link href="/" aria-label="GatePass home" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white">
                    <GatePassMark />
                    <span className="text-[17px] font-bold tracking-[-0.04em]">GatePass</span>
                </Link>
                <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4b4b4b] transition-colors hover:text-black focus-visible:outline-none focus-visible:underline dark:text-[#bbb] dark:hover:text-white">
                    Explore events <ArrowUpRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </Link>
            </header>

            <div className="mx-auto grid w-full max-w-[1180px] flex-1 gap-10 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-24 lg:pt-20">
                <aside className="lg:pt-2">
                    <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#777] dark:text-[#999]">Legal</p>
                    <nav aria-label="Legal pages" className="flex gap-2 lg:flex-col">
                        {pages.map((page) => (
                            <Link
                                key={page.key}
                                href={page.href}
                                aria-current={activePage === page.key ? 'page' : undefined}
                                className={'rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ' + (activePage === page.key
                                    ? 'bg-[#f2f2f2] text-black dark:bg-[#222] dark:text-white'
                                    : 'text-[#777] hover:bg-[#f7f7f7] hover:text-black dark:text-[#aaa] dark:hover:bg-[#181818] dark:hover:text-white')}
                            >
                                {page.label}
                            </Link>
                        ))}
                    </nav>
                </aside>

                <article className="min-w-0 max-w-[760px]">
                    <header className="border-b border-[#e8e8e8] pb-10 dark:border-[#2d2d2d]">
                        <h1 className="text-[clamp(2.65rem,5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.06em]">{title}</h1>
                        <p className="mt-6 max-w-[670px] text-[16px] leading-[1.75] text-[#555] sm:text-[17px] dark:text-[#b5b5b5]">{introduction}</p>
                    </header>
                    <div>{children}</div>
                </article>
            </div>

            <footer className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 border-t border-[#ededed] px-5 py-5 text-[12px] text-[#777] sm:px-8 dark:border-[#252525] dark:text-[#999]">
                <span>© {new Date().getFullYear()} GatePass</span>
                <a href="mailto:support@gatepass.so" className="hover:text-black focus-visible:underline dark:hover:text-white">Questions? Contact support</a>
            </footer>
        </div>
    )
}

export function LegalSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
    return (
        <section className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-[#e8e8e8] py-9 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-6 sm:py-11 dark:border-[#2d2d2d]">
            <span aria-hidden="true" className="pt-1 text-[12px] font-semibold tabular-nums text-[#999] dark:text-[#777]">{number}</span>
            <div>
                <h2 className="text-[20px] font-semibold leading-[1.25] tracking-[-0.035em] sm:text-[22px]">{title}</h2>
                <div className="mt-4 space-y-4 text-[15px] leading-[1.8] text-[#555] sm:text-[16px] dark:text-[#b5b5b5] [&_a]:font-medium [&_a]:text-black [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-white [&_strong]:font-semibold [&_strong]:text-black dark:[&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
            </div>
        </section>
    )
}
