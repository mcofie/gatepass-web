import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Check, Lock } from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { OfferingReveal } from './OfferingReveal'
import { getActivePricingTiers } from '@/lib/public-data'
import { formatCurrency } from '@/utils/format'
import { PROVIDERS } from '@/lib/integrations/providers'
import styles from './offering.module.css'

export const metadata: Metadata = {
    title: 'For Organizers',
    description: 'Sell tickets through your own payment account. 0% per ticket, one flat fee per event. Event pages, embeds, SDKs and AI assistants, all from one place.',
}

// Every payment provider organizers can connect, straight from the catalog
const PAYMENT_BRANDS = PROVIDERS.filter(p => p.category === 'payments').map(p => ({ id: p.id, name: p.name.replace(/ \(.*\)$/, '') }))

const MESSAGING_BRANDS = [
    { id: 'twilio', name: 'Twilio' },
    { id: 'clicksend', name: 'ClickSend' },
    { id: 'zend', name: 'Zend' },
    { id: 'hubtel', name: 'Hubtel' },
    { id: 'meta', name: 'Meta Pixel' },
    { id: 'ga4', name: 'Google Analytics' },
]

const primaryLink = 'group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-7 text-[14px] font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[#333] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-[#e7e7e7] dark:focus-visible:ring-white dark:focus-visible:ring-offset-black'
const invertedLink = 'group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[14px] font-semibold text-black transition-[background-color,transform] duration-200 hover:bg-[#e7e7e7] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

function Chapter({ number, label, title, children, dark = false, id }: {
    number: string
    label: string
    title: ReactNode
    children: ReactNode
    dark?: boolean
    id?: string
}) {
    return (
        <section id={id} className={`scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32 lg:px-12 ${dark ? 'bg-black text-white' : ''}`}>
            <div className="mx-auto max-w-[1280px]">
                <OfferingReveal>
                    <p className={`flex items-center gap-3 text-[13px] font-medium tabular-nums ${dark ? 'text-white/50' : 'text-[#777] dark:text-[#999]'}`}>
                        <span>{number}</span>
                        <span className={`h-px w-8 ${dark ? 'bg-white/30' : 'bg-black/20 dark:bg-white/25'}`} />
                        <span>{label}</span>
                    </p>
                    <h2 className="mt-6 max-w-[920px] text-[clamp(2.6rem,6.4vw,6rem)] font-semibold leading-[0.98] tracking-[-0.065em] text-balance">{title}</h2>
                </OfferingReveal>
                {children}
            </div>
        </section>
    )
}

function BrandTile({ id, name, dark = false }: { id: string; name: string; dark?: boolean }) {
    return (
        <div className={`flex items-center gap-3 rounded-3xl border p-4 sm:p-5 ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-black/[0.07] bg-[#f6f6f6] dark:border-white/10 dark:bg-white/[0.04]'}`}>
            <Image src={`/brands/${id}.png`} alt="" width={40} height={40} className="size-10 rounded-xl bg-white object-contain" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">{name}</span>
        </div>
    )
}

function Point({ title, children, dark = false }: { title: string; children: ReactNode; dark?: boolean }) {
    return (
        <div className={`border-t pt-5 ${dark ? 'border-white/15' : 'border-black/10 dark:border-white/15'}`}>
            <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h3>
            <p className={`mt-2 text-[14px] leading-[1.6] ${dark ? 'text-white/55' : 'text-[#666] dark:text-[#aaa]'}`}>{children}</p>
        </div>
    )
}

export default async function OurOfferingPage() {
    const tiers = await getActivePricingTiers()

    return (
        <div className="overflow-x-clip bg-white text-[#0d0d0d] dark:bg-[#0a0a0a] dark:text-white">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 text-white backdrop-blur-xl">
                <div className="mx-auto flex h-[64px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
                    <Link href="/" className="inline-flex shrink-0 items-center gap-2 text-[16px] font-semibold tracking-[-0.035em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <GatePassMark className="size-6 invert" invertOnDark={false} />
                        GatePass
                        <span className="ml-2 hidden border-l border-white/20 pl-3 text-[12px] font-normal tracking-normal text-white/55 sm:inline">For organizers</span>
                    </Link>
                    <nav aria-label="Page sections" className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
                        <a href="#payments" className="transition-colors hover:text-white">Payments</a>
                        <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
                        <a href="#anywhere" className="transition-colors hover:text-white">Sell anywhere</a>
                        <a href="#guests" className="transition-colors hover:text-white">Guests</a>
                    </nav>
                    <Link href="/onboarding" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition-colors hover:bg-[#e7e7e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        Get started <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section className="relative bg-black px-5 pb-20 pt-20 text-white sm:px-8 sm:pt-28 lg:px-12">
                <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                        <p className={`${styles.heroEnter} text-[13px] font-medium text-white/55`}>Ticketing for organizers</p>
                        <h1 className={`${styles.heroEnter} ${styles.heroDelayOne} mt-5 text-[clamp(3.4rem,9.5vw,8.6rem)] font-semibold leading-[0.92] tracking-[-0.075em]`}>
                            Your events.<br />Your money.
                        </h1>
                        <p className={`${styles.heroEnter} ${styles.heroDelayTwo} mt-7 max-w-[520px] text-[17px] leading-[1.6] text-white/60 sm:text-[19px]`}>
                            Sell tickets through your own payment account. GatePass takes 0% of every ticket, just one flat fee per event.
                        </p>
                        <div className={`${styles.heroEnter} ${styles.heroDelayThree} mt-9 flex flex-col gap-3 sm:flex-row sm:items-center`}>
                            <Link href="/onboarding" className={invertedLink}>
                                Create your event <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <a href="#pricing" className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 px-7 text-[14px] font-semibold transition-colors hover:bg-white/10">
                                See pricing
                            </a>
                        </div>
                    </div>

                    {/* Phone: the checkout guests see */}
                    <div className={`${styles.heroEnter} ${styles.heroDelayFour} relative mx-auto w-full max-w-[340px]`} aria-hidden="true">
                        <div className={`${styles.heroAura} absolute inset-0 -z-0 scale-125 rounded-full bg-white/10 blur-[80px]`} />
                        <div className="relative rounded-[44px] border border-white/15 bg-[#111] p-3 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
                            <div className="overflow-hidden rounded-[34px] bg-white text-black">
                                <div className={`${styles.posterArt} relative h-[190px] p-5 text-white`}>
                                    <p className="relative z-10 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">Sat 20 Dec · Accra</p>
                                    <p className="relative z-10 mt-[86px] text-[30px] font-semibold leading-[0.92] tracking-[-0.07em]">THE NIGHT<br />SESSION</p>
                                </div>
                                <div className="space-y-3 p-5">
                                    <div className="flex items-center justify-between text-[13px]"><span>2 × General admission</span><span className="font-semibold">GH₵240</span></div>
                                    <div className="flex items-center justify-between text-[13px]"><span className="text-[#777]">GatePass fee</span><span className="font-semibold">GH₵0</span></div>
                                    <div className="flex items-center justify-between border-t border-black/10 pt-3 text-[15px] font-semibold"><span>Total</span><span>GH₵240</span></div>
                                    <div className="rounded-full bg-black py-3.5 text-center text-[13px] font-semibold text-white">Pay GH₵240</div>
                                    <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-[#777]">
                                        <Lock className="size-3" /> Secure payment by
                                        <Image src="/brands/paystack.png" alt="" width={14} height={14} className="size-3.5 rounded" />
                                        <span className="font-semibold text-black">Paystack</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto mt-20 grid max-w-[1280px] grid-cols-2 gap-y-8 border-t border-white/15 pt-8 sm:grid-cols-4">
                    {[
                        ['0%', 'GatePass fee per ticket'],
                        [String(PAYMENT_BRANDS.length), 'Payment providers'],
                        ['1', 'Flat fee per event'],
                        ['3', 'Ways to sell: page, embed, AI'],
                    ].map(([value, label]) => (
                        <div key={label}>
                            <p className="text-[clamp(2.2rem,4vw,3.4rem)] font-semibold leading-none tracking-[-0.06em]">{value}</p>
                            <p className="mt-2 text-[13px] text-white/50">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            <Chapter id="payments" number="01" label="Payments" title="Paid straight to your account.">
                <div className="mt-14 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
                    <OfferingReveal className="space-y-8">
                        <p className="max-w-[440px] text-[17px] leading-[1.65] text-[#666] dark:text-[#aaa]">
                            Connect the payment account you already use. Guests pay you directly, by card or mobile money, and GatePass never holds your money.
                        </p>
                        <div className="space-y-6">
                            <Point title="No payouts to wait for">Money lands in your provider balance as each order completes.</Point>
                            <Point title="The right currency, every time">Each event sells in a currency your provider supports, from GHS and NGN to KES, XOF, USD and more.</Point>
                            <Point title="Pick a default, change it per event">One provider for the whole organization, or a different one for a single event.</Point>
                        </div>
                    </OfferingReveal>
                    <OfferingReveal delay={0.08} className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
                        {PAYMENT_BRANDS.map(brand => <BrandTile key={brand.id} {...brand} />)}
                    </OfferingReveal>
                </div>
            </Chapter>

            <Chapter id="pricing" number="02" label="Pricing" title={<>One fee per event.<br />None per ticket.</>} dark>
                <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-20">
                    <OfferingReveal>
                        <p className="text-[13px] text-white/50">GatePass fee on ticket sales</p>
                        <p className="mt-2 flex items-baseline gap-2">
                            <strong className="text-[clamp(6rem,14vw,12rem)] font-semibold leading-[0.85] tracking-[-0.09em]">0</strong>
                            <span className="text-[clamp(2rem,4vw,4rem)] font-medium">%</span>
                        </p>
                        <p className="mt-8 max-w-[440px] text-[16px] leading-[1.65] text-white/60">
                            Pay once before you publish, sized to how many tickets you&apos;re selling. Free events stay free.
                        </p>
                    </OfferingReveal>
                    <OfferingReveal delay={0.08}>
                        <div className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/15">
                            {tiers.map((tier, index) => (
                                <div key={tier.name} className="flex items-center justify-between gap-4 px-6 py-5">
                                    <div>
                                        <p className="text-[16px] font-semibold">{tier.name}</p>
                                        <p className="mt-0.5 text-[13px] text-white/50">
                                            {tier.max_tickets === null
                                                ? `${((tiers[index - 1]?.max_tickets ?? 0) + 1).toLocaleString()}+ tickets`
                                                : `Up to ${tier.max_tickets.toLocaleString()} tickets`}
                                        </p>
                                    </div>
                                    <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{tier.price_minor === 0 ? 'Free' : formatCurrency(tier.price_minor / 100, tier.currency)}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-[12px] leading-[1.5] text-white/40">One-time, per event. Your payment provider charges its own processing fees.</p>
                    </OfferingReveal>
                </div>
            </Chapter>

            <Chapter id="anywhere" number="03" label="Distribution" title="Sell wherever your audience is.">
                <div className="mt-14 grid gap-5 md:grid-cols-3">
                    {[
                        { title: 'Event pages', body: 'A video-led page for every event, with checkout built in and a link that previews well anywhere you share it.', tag: 'gatepass.so/events/…' },
                        { title: 'Your website', body: 'Drop in one script tag, or use the React, Vue and Nuxt packages. Same checkout, in your own design.', tag: '<script src="…/embed.js">' },
                        { title: 'AI assistants', body: 'Guests can ask an assistant for tickets. GatePass’s MCP server finds your event and hands them a checkout link.', tag: 'gatepass.so/api/mcp' },
                    ].map((card, index) => (
                        <OfferingReveal key={card.title} delay={index * 0.06} className="flex flex-col rounded-3xl bg-[#f4f4f4] p-6 dark:bg-white/[0.05] sm:p-8">
                            <p className="text-[13px] font-medium tabular-nums text-[#888]">{String(index + 1).padStart(2, '0')}</p>
                            <h3 className="mt-10 text-[26px] font-semibold tracking-[-0.045em]">{card.title}</h3>
                            <p className="mt-3 text-[14px] leading-[1.6] text-[#666] dark:text-[#aaa]">{card.body}</p>
                            <code className="mt-8 block truncate rounded-2xl bg-white px-4 py-3 font-mono text-[12px] text-[#444] dark:bg-black/40 dark:text-[#ccc]">{card.tag}</code>
                        </OfferingReveal>
                    ))}
                </div>
            </Chapter>

            <Chapter id="guests" number="04" label="Guests" title="Know your crowd. Look after them." dark>
                <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-20">
                    <OfferingReveal className="grid gap-6 sm:grid-cols-2">
                        <Point dark title="Passes in their wallet">Every ticket works with Apple Wallet, email and a QR code at the door.</Point>
                        <Point dark title="Profiles guests choose to share">Interests, dietary and access needs, so you can plan for the people coming.</Point>
                        <Point dark title="Forms and add-ons">Ask for sizes or preferences, and sell merch, parking or upgrades at checkout.</Point>
                        <Point dark title="See what sells">Tracking links, sales by source and every order in one place.</Point>
                    </OfferingReveal>
                    <OfferingReveal delay={0.08}>
                        <p className="text-[13px] text-white/50">Messages and analytics, through your own accounts</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {MESSAGING_BRANDS.map(brand => <BrandTile key={`${brand.id}-${brand.name}`} {...brand} dark />)}
                        </div>
                    </OfferingReveal>
                </div>
            </Chapter>

            <section className="px-5 py-24 sm:px-8 sm:py-36 lg:px-12">
                <OfferingReveal className="mx-auto max-w-[1280px] text-center">
                    <h2 className="mx-auto max-w-[900px] text-[clamp(3rem,8vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.075em] text-balance">Make something worth showing up for.</h2>
                    <ul className="mx-auto mt-8 flex max-w-[640px] flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-[#666] dark:text-[#aaa]">
                        {['Your payment account', '0% per ticket', 'Live in minutes'].map(item => (
                            <li key={item} className="inline-flex items-center gap-1.5"><Check className="size-4" aria-hidden="true" />{item}</li>
                        ))}
                    </ul>
                    <Link href="/onboarding" className={`${primaryLink} mt-10`}>
                        Create your event <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </OfferingReveal>
            </section>
        </div>
    )
}
