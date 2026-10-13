import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    Check,
    ChevronRight,
    CirclePlay,
    CreditCard,
    ScanLine,
    Ticket,
    Users,
} from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { OfferingReveal } from './OfferingReveal'
import { createClient } from '@/utils/supabase/server'
import { formatCurrency } from '@/utils/format'
import styles from './offering.module.css'

export const metadata: Metadata = {
    title: 'For Organizers',
    description: 'Bring your event to life with video-led discovery, flexible ticket payments, and tools for every moment from launch to last scan.',
}

const primaryLink = 'group inline-flex h-11 items-center justify-center gap-3 rounded-full bg-black px-6 text-[13px] font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[#333] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-[#e7e7e7] dark:focus-visible:ring-white dark:focus-visible:ring-offset-black'

function FeatureCard({ number, title, description, children }: {
    number: string
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <OfferingReveal className="min-w-0">
            <div className="relative flex h-[270px] items-center justify-center overflow-hidden rounded-[18px] border border-black/[0.04] bg-[#f4f4f4] transition-colors duration-300 dark:border-white/10 dark:bg-[#1b1b1b] sm:h-[310px]">
                {children}
            </div>
            <div className="mt-5 flex items-start gap-5 border-t border-black/10 pt-5 dark:border-white/15">
                <span className="pt-1 text-[11px] font-medium tabular-nums text-[#888] dark:text-[#999]">{number}</span>
                <div>
                    <h3 className="text-[22px] font-semibold tracking-[-0.035em] sm:text-[24px]">{title}</h3>
                    <p className="mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#666] dark:text-[#aaa]">{description}</p>
                </div>
            </div>
        </OfferingReveal>
    )
}

export default async function OurOfferingPage() {
    const supabase = await createClient()
    const { data } = await supabase
        .schema('gatepass')
        .from('platform_pricing_tiers')
        .select('name, max_tickets, price_minor, currency')
        .eq('is_active', true)
        .order('sort_order')
    const tiers = (data ?? []) as { name: string; max_tickets: number | null; price_minor: number; currency: string }[]

    return (
        <div className="overflow-x-clip bg-white text-[#0d0d0d] dark:bg-[#0a0a0a] dark:text-white">
            <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
                <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
                    <Link href="/" className="inline-flex shrink-0 items-center gap-2 text-[16px] font-semibold tracking-[-0.035em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white">
                        <GatePassMark className="size-6" />
                        GatePass
                        <span className="ml-2 hidden border-l border-black/15 pl-3 text-[12px] font-normal tracking-normal text-[#777] dark:border-white/20 dark:text-[#aaa] sm:inline">For organizers</span>
                    </Link>
                    <nav aria-label="Page sections" className="hidden items-center gap-7 text-[12px] font-medium text-[#666] dark:text-[#aaa] md:flex">
                        <a href="#platform" className="transition-colors hover:text-black focus-visible:outline-none focus-visible:underline dark:hover:text-white">Platform</a>
                        <a href="#workflow" className="transition-colors hover:text-black focus-visible:outline-none focus-visible:underline dark:hover:text-white">How it works</a>
                        <a href="#pricing" className="transition-colors hover:text-black focus-visible:outline-none focus-visible:underline dark:hover:text-white">Pricing</a>
                    </nav>
                    <Link href="/onboarding" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-black/15 px-4 text-[12px] font-semibold transition-colors hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-white/25 dark:hover:bg-white dark:hover:text-black dark:focus-visible:ring-white">
                        Get started <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                </div>
            </header>

            <div>
                <section className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-32">
                    <div className="relative z-10 mx-auto max-w-[1050px] text-center">
                        <p className={`${styles.heroEnter} text-[11px] font-semibold uppercase tracking-[0.2em] text-[#777] dark:text-[#aaa]`}>The platform for live experiences</p>
                        <h1 className={`${styles.heroEnter} ${styles.heroDelayOne} mx-auto mt-6 max-w-[1000px] text-[clamp(3.3rem,9vw,8.4rem)] font-semibold leading-[0.96] tracking-[-0.08em] text-balance`}>
                            The stage is yours.
                        </h1>
                        <p className={`${styles.heroEnter} ${styles.heroDelayTwo} mx-auto mt-7 max-w-[550px] text-[16px] leading-[1.6] text-[#666] dark:text-[#aaa] sm:text-[18px]`}>
                            Create a page people feel. Sell tickets in a few taps. Run the room with confidence.
                        </p>
                        <div className={`${styles.heroEnter} ${styles.heroDelayThree} mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row`}>
                            <Link href="/onboarding" className={primaryLink}>
                                Create your event <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <a href="#platform" className="inline-flex h-11 items-center gap-2 px-3 text-[13px] font-medium text-[#555] transition-colors hover:text-black focus-visible:outline-none focus-visible:underline dark:text-[#bbb] dark:hover:text-white">
                                Explore the platform <ChevronRight aria-hidden="true" className="size-4" />
                            </a>
                        </div>
                    </div>

                    <div className={`${styles.heroEnter} ${styles.heroDelayFour} pointer-events-none relative mx-auto mt-14 h-[390px] w-full max-w-[760px] sm:mt-16 sm:h-[500px]`} aria-hidden="true">
                        <div className={`${styles.heroAura} absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ededed] blur-[70px] dark:bg-white/10 sm:h-[540px] sm:w-[540px]`} />
                        <div className={`${styles.posterFloat} ${styles.posterArt} absolute left-[8%] top-0 flex h-[340px] w-[245px] flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#171717] p-5 text-white shadow-[0_28px_70px_rgba(0,0,0,0.23)] sm:left-[19%] sm:h-[435px] sm:w-[330px] sm:rounded-[28px] sm:p-7`}>
                            <div className="relative z-10 flex items-start justify-between text-[9px] font-medium uppercase tracking-[0.17em] text-white/75 sm:text-[11px]">
                                <span>GatePass presents</span>
                                <span>01 / 03</span>
                            </div>
                            <div className="relative z-10 mt-auto">
                                <span className="mb-3 block h-px w-10 bg-white/70" />
                                <p className="text-[36px] font-semibold leading-[0.92] tracking-[-0.075em] sm:text-[54px]">THE NIGHT<br />SESSION</p>
                                <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-white/70 sm:text-[11px]">Accra · Live experience</p>
                            </div>
                        </div>
                        <div className={`${styles.ticketFloat} absolute right-[4%] top-[205px] w-[225px] rounded-[16px] border border-[#e7e7e7] bg-white p-4 text-black shadow-[0_22px_60px_rgba(0,0,0,0.16)] dark:border-[#555] sm:right-[11%] sm:top-[250px] sm:w-[310px] sm:rounded-[20px] sm:p-5`}>
                            <div className="flex items-center justify-between border-b border-dashed border-black/20 pb-4">
                                <div className="flex items-center gap-2 text-[12px] font-semibold sm:text-[14px]"><GatePassMark className="size-5 sm:size-6" invertOnDark={false} /> GatePass</div>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#777] sm:text-[10px]">Admit one</span>
                            </div>
                            <div className="py-4">
                                <p className="text-[10px] text-[#777]">Your ticket</p>
                                <p className="mt-1 text-[17px] font-semibold tracking-[-0.04em] sm:text-[22px]">The Night Session</p>
                                <p className="mt-1 text-[10px] text-[#777] sm:text-[12px]">General admission · Accra</p>
                            </div>
                            <div className="h-7 w-full opacity-80 sm:h-9" style={{ background: 'repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 5px, transparent 5px 9px)' }} />
                            <p className="mt-2 text-[9px] tracking-[0.2em] text-[#777]">GP — 0001 0426</p>
                        </div>
                    </div>
                    <p className="mt-1 text-center text-[10px] text-[#999]">Illustrative product preview</p>

                    <div className="mx-auto mt-20 grid max-w-[1100px] grid-cols-1 border-y border-black/10 py-5 text-[12px] font-medium text-[#666] dark:border-white/15 dark:text-[#aaa] sm:grid-cols-3 sm:divide-x sm:divide-black/10 sm:py-6 dark:sm:divide-white/15">
                        <span className="py-2 text-center sm:py-0">Video-led discovery</span>
                        <span className="py-2 text-center sm:py-0">Flexible ticket payments</span>
                        <span className="py-2 text-center sm:py-0">Live event operations</span>
                    </div>
                </section>

                <section id="platform" className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
                    <div className="mx-auto max-w-[1280px]">
                        <OfferingReveal className="max-w-[780px]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777] dark:text-[#aaa]">One connected platform</p>
                            <h2 className="mt-5 text-[clamp(2.8rem,6vw,5.8rem)] font-semibold leading-[1.02] tracking-[-0.07em] text-balance">
                                From first impression to final scan.
                            </h2>
                            <p className="mt-6 max-w-[600px] text-[16px] leading-[1.6] text-[#666] dark:text-[#aaa] sm:text-[18px]">
                                Every step feels connected, for the people planning the event and the people showing up.
                            </p>
                        </OfferingReveal>

                        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-5">
                            <FeatureCard number="01" title="Show the experience" description="Lead with video and give people a real feel for what is coming before they book.">
                                <div aria-hidden="true" className="relative flex h-[230px] w-[160px] flex-col overflow-hidden rounded-[18px] border-[5px] border-[#171717] bg-[#171717] p-3 text-white shadow-[0_15px_35px_rgba(0,0,0,0.2)] sm:h-[265px] sm:w-[185px]">
                                    <div className={`${styles.miniPoster} absolute inset-0`} />
                                    <span className="relative z-10 text-[9px] font-medium tracking-[0.16em]">FEATURED EVENT</span>
                                    <CirclePlay className="relative z-10 m-auto size-10 text-white/90" strokeWidth={1.2} />
                                    <div className="relative z-10 mt-auto">
                                        <p className="text-[17px] font-semibold leading-none tracking-[-0.06em]">THE NIGHT<br />SESSION</p>
                                        <div className="mt-3 h-1.5 w-full rounded-full bg-white/25"><div className="h-full w-2/5 rounded-full bg-white" /></div>
                                    </div>
                                </div>
                            </FeatureCard>

                            <FeatureCard number="02" title="Make checkout easy" description="Offer clear ticket choices and instalment plans where you enable them.">
                                <div aria-hidden="true" className="w-[84%] max-w-[300px] rounded-[16px] border border-black/10 bg-white p-4 text-[#111] shadow-[0_16px_38px_rgba(0,0,0,0.08)]">
                                    <div className="flex items-center justify-between border-b border-black/10 pb-3 text-[10px] font-semibold"><span>Choose your ticket</span><Ticket className="size-4" strokeWidth={1.5} /></div>
                                    <div className="flex items-center justify-between py-4 text-[12px]"><span>General admission</span><span className="font-semibold">GH₵120</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-medium"><div className="rounded-[8px] border border-black bg-[#f5f5f5] py-2">Pay in full</div><div className="rounded-[8px] border border-black/10 py-2">Pay in 3</div></div>
                                    <div className="mt-4 rounded-full bg-black py-2.5 text-center text-[10px] font-semibold text-white">Continue</div>
                                </div>
                            </FeatureCard>

                            <FeatureCard number="03" title="Stay in control" description="See sales and check-ins as they happen, with your team working from one place.">
                                <div aria-hidden="true" className="w-[88%] max-w-[325px] rounded-[16px] border border-white/10 bg-[#171717] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                                    <div className="flex items-center justify-between border-b border-white/15 pb-3 text-[10px]"><span className="font-semibold">Live monitor</span><span className="flex items-center gap-1.5 text-white/60"><span className="size-1.5 rounded-full bg-white" /> LIVE</span></div>
                                    <div className="mt-4 flex items-end justify-between"><div><p className="text-[10px] text-white/50">Guests checked in</p><p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.06em]">824</p></div><ScanLine className="size-5 text-white/60" strokeWidth={1.4} /></div>
                                    <div className="mt-5 flex h-14 items-end gap-1.5">{[40, 55, 48, 70, 62, 88, 75, 100, 90].map((height, index) => <div key={index} className="flex-1 rounded-t-[2px] bg-white/60" style={{ height: `${height}%` }} />)}</div>
                                </div>
                            </FeatureCard>
                        </div>
                    </div>
                </section>

                <section id="workflow" className="scroll-mt-16 bg-[#111] px-5 py-24 text-white sm:px-8 sm:py-32 lg:px-12">
                    <div className="mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
                        <OfferingReveal>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Made for the whole journey</p>
                            <h2 className="mt-5 max-w-[620px] text-[clamp(2.9rem,5.4vw,5.5rem)] font-semibold leading-[1.03] tracking-[-0.07em] text-balance">Make the plan. Fill the room. Own the night.</h2>
                            <p className="mt-6 max-w-[510px] text-[16px] leading-[1.65] text-white/60">Publish your event, manage every ticket type, and give your team the tools to keep the doors moving.</p>
                            <Link href="/onboarding" className="group mt-9 inline-flex items-center gap-3 border-b border-white/50 pb-2 text-[13px] font-semibold transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                                Start organizing <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </Link>
                        </OfferingReveal>

                        <OfferingReveal delay={0.1}>
                            <div aria-hidden="true" className="overflow-hidden rounded-[20px] border border-white/15 bg-[#1b1b1b] shadow-[0_32px_80px_rgba(0,0,0,0.25)]">
                                <div className="flex h-12 items-center justify-between border-b border-white/10 px-5 text-[11px]"><span className="flex items-center gap-2 font-semibold"><GatePassMark className="size-4 invert" invertOnDark={false} /> GatePass Studio</span><span className="text-white/45">Overview</span></div>
                                <div className="p-5 sm:p-7">
                                    <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] text-white/45">Your event</p><p className="mt-1 text-[22px] font-semibold tracking-[-0.045em] sm:text-[28px]">The Night Session</p></div><span className="rounded-full border border-white/25 px-2.5 py-1 text-[10px] text-white/75">On sale</span></div>
                                    <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-[12px] border border-white/10 bg-white/[0.05] p-4"><Ticket className="size-4 text-white/55" strokeWidth={1.5} /><p className="mt-5 text-[25px] font-semibold leading-none tracking-[-0.05em] sm:text-[30px]">1,284</p><p className="mt-1 text-[10px] text-white/45">Tickets sold</p></div><div className="rounded-[12px] border border-white/10 bg-white/[0.05] p-4"><ScanLine className="size-4 text-white/55" strokeWidth={1.5} /><p className="mt-5 text-[25px] font-semibold leading-none tracking-[-0.05em] sm:text-[30px]">824</p><p className="mt-1 text-[10px] text-white/45">Checked in</p></div></div>
                                    <div className="mt-3 rounded-[12px] border border-white/10 bg-white/[0.05] p-4"><div className="flex justify-between text-[10px]"><span className="text-white/50">Entry progress</span><span>64%</span></div><div className="mt-3 h-1.5 rounded-full bg-white/15"><div className={`${styles.progressFill} h-full w-[64%] rounded-full bg-white`} /></div></div>
                                    <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.05] p-3 text-[11px]"><div className="flex size-8 items-center justify-center rounded-[8px] bg-white/10"><Check className="size-4" /></div><span className="flex-1 text-white/65">A ticket was just checked in</span><span className="text-white/35">Now</span></div>
                                </div>
                            </div>
                        </OfferingReveal>
                    </div>

                    <div className="mx-auto mt-20 grid max-w-[1280px] gap-8 border-t border-white/15 pt-9 sm:grid-cols-3 sm:gap-10">
                        <OfferingReveal><div className="flex items-start gap-4"><CreditCard className="mt-0.5 size-5 shrink-0 text-white/60" strokeWidth={1.5} /><div><h3 className="text-[15px] font-semibold">Ticket flexibility</h3><p className="mt-2 text-[13px] leading-[1.6] text-white/50">Set up tiers, add-ons, and payment plans to suit your event.</p></div></div></OfferingReveal>
                        <OfferingReveal delay={0.08}><div className="flex items-start gap-4"><Users className="mt-0.5 size-5 shrink-0 text-white/60" strokeWidth={1.5} /><div><h3 className="text-[15px] font-semibold">One team, one view</h3><p className="mt-2 text-[13px] leading-[1.6] text-white/50">Give collaborators access to the parts of the event they run.</p></div></div></OfferingReveal>
                        <OfferingReveal delay={0.16}><div className="flex items-start gap-4"><BarChart3 className="mt-0.5 size-5 shrink-0 text-white/60" strokeWidth={1.5} /><div><h3 className="text-[15px] font-semibold">Useful insight</h3><p className="mt-2 text-[13px] leading-[1.6] text-white/50">Follow sales, guests, and performance from your dashboard.</p></div></div></OfferingReveal>
                    </div>
                </section>

                <section id="pricing" className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
                    <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-2 lg:gap-24">
                        <OfferingReveal>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777] dark:text-[#aaa]">Straightforward pricing</p>
                            <h2 className="mt-5 max-w-[650px] text-[clamp(2.9rem,5.4vw,5.5rem)] font-semibold leading-[1.03] tracking-[-0.07em] text-balance">One fee per event. None per ticket.</h2>
                            <p className="mt-6 max-w-[470px] text-[16px] leading-[1.65] text-[#666] dark:text-[#aaa]">Pay once before you publish, based on how many tickets you&apos;re selling. Ticket money goes straight to your own Stripe, Paystack, Flutterwave, Hubtel, M-Pesa or Wave account.</p>
                        </OfferingReveal>

                        <OfferingReveal delay={0.1} className="border-t border-black/15 pt-6 dark:border-white/20 lg:pt-8">
                            <p className="text-[12px] text-[#777] dark:text-[#aaa]">GatePass fee on ticket sales</p>
                            <div className="mt-2 flex items-baseline gap-2"><strong className="text-[clamp(5rem,9vw,9rem)] font-semibold leading-none tracking-[-0.09em]">0</strong><span className="text-[clamp(2rem,3vw,3.3rem)] font-medium">%</span></div>
                            <div className="mt-8 divide-y divide-black/10 border-y border-black/10 text-[13px] dark:divide-white/15 dark:border-white/15">
                                {tiers.map((tier, index) => (
                                    <div key={tier.name} className="flex justify-between gap-4 py-4">
                                        <span className="text-[#666] dark:text-[#aaa]">
                                            <span className="font-medium text-black dark:text-white">{tier.name}</span>
                                            {' · '}
                                            {tier.max_tickets === null
                                                ? `${((tiers[index - 1]?.max_tickets ?? 0) + 1).toLocaleString()}+ tickets`
                                                : `Up to ${tier.max_tickets.toLocaleString()} tickets`}
                                        </span>
                                        <span className="font-medium tabular-nums">{tier.price_minor === 0 ? 'Free' : formatCurrency(tier.price_minor / 100, tier.currency)}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 max-w-[500px] text-[11px] leading-[1.5] text-[#888] dark:text-[#999]">One-time, per event. Your payment provider charges its own processing fees.</p>
                        </OfferingReveal>
                    </div>
                </section>

                <section className="border-t border-black/10 px-5 py-24 dark:border-white/15 sm:px-8 sm:py-32 lg:px-12">
                    <OfferingReveal className="mx-auto max-w-[1280px] text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#777] dark:text-[#aaa]">Ready when you are</p>
                        <h2 className="mx-auto mt-5 max-w-[840px] text-[clamp(3rem,7vw,7rem)] font-semibold leading-[1] tracking-[-0.075em] text-balance">Make something worth showing up for.</h2>
                        <p className="mx-auto mt-6 max-w-[480px] text-[16px] leading-[1.6] text-[#666] dark:text-[#aaa]">Set the date. Tell the story. We will help with everything between the first ticket and the last scan.</p>
                        <Link href="/onboarding" className={`${primaryLink} mt-9`}>
                            Create your event <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </OfferingReveal>
                </section>
            </div>
        </div>
    )
}
