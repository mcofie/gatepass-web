'use client'

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Event } from '@/types/gatepass'
import { Switch } from '@/components/dashboard/ui'

const noopSubscribe = () => () => {}

type Style = 'inline' | 'button'
type Platform = 'html' | 'wordpress' | 'webflow' | 'framer' | 'squarespace' | 'wix' | 'iframe' | 'react' | 'vue' | 'nuxt'

const PLATFORMS: { id: Platform; label: string; steps: string[]; snippet: 'loader' | 'iframe' | 'react' | 'vue' | 'nuxt' }[] = [
    { id: 'html', label: 'HTML', snippet: 'loader', steps: ['Paste the code where the widget should appear, anywhere inside <body>.', 'The script only needs to be on the page once, even with several widgets or buttons.'] },
    { id: 'wordpress', label: 'WordPress', snippet: 'loader', steps: ['Edit the page and add a Custom HTML block.', 'Paste the code and update the page.', 'On WordPress.com plans without custom code, use the iframe code instead.'] },
    { id: 'webflow', label: 'Webflow', snippet: 'loader', steps: ['From the Add panel, drag a Code Embed element onto the page.', 'Paste the code and save.', 'Publish the site. Embeds only run on the published site, not in the Designer.'] },
    { id: 'framer', label: 'Framer', snippet: 'loader', steps: ['Insert → Embed, and choose HTML.', 'Paste the code.', 'For the inline widget, give the Embed a height of about 700. The button works at any size.'] },
    { id: 'squarespace', label: 'Squarespace', snippet: 'loader', steps: ['Edit the page, add a block and choose Code.', 'Paste the code and turn off "Display source".', 'Code blocks need a Squarespace plan that allows custom code.'] },
    { id: 'wix', label: 'Wix', snippet: 'iframe', steps: ['Add → Embed Code → Embed HTML.', 'Choose "Code", paste the iframe below and set the element height to about 700.', 'Wix runs custom code in its own frame, so auto-resize and the pop-up button aren\'t available there.'] },
    { id: 'iframe', label: 'iframe', snippet: 'iframe', steps: ['Use this anywhere scripts aren\'t allowed.', 'Set a fixed height; the widget scrolls inside it.'] },
    { id: 'react', label: 'React', snippet: 'react', steps: ['npm install @gatepass/react', 'Use the component anywhere. It works with Next.js App Router too.'] },
    { id: 'vue', label: 'Vue', snippet: 'vue', steps: ['npm install @gatepass/vue', 'Register the plugin once with app.use(GatePass), then use the component.'] },
    { id: 'nuxt', label: 'Nuxt', snippet: 'nuxt', steps: ['npm install @gatepass/nuxt', 'Add \'@gatepass/nuxt\' to modules in nuxt.config.ts. Components are auto-imported.'] },
]

export function WidgetsTab({ event }: { event: Event }) {
    // Snippets point at whichever GatePass the organizer is using (local, preview or production)
    const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so')
    const [style, setStyle] = useState<Style>('inline')
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [startOnTickets, setStartOnTickets] = useState(false)
    const [ref, setRef] = useState('')
    const [platform, setPlatform] = useState<Platform>('html')
    const [copied, setCopied] = useState<string | null>(null)
    const slug = event.slug || event.id

    // Load the real loader once so the preview behaves exactly like a customer's site
    useEffect(() => {
        if (document.querySelector('script[data-gatepass-loader]')) return
        const script = document.createElement('script')
        script.src = '/embed.js'
        script.async = true
        script.setAttribute('data-gatepass-loader', 'true')
        document.body.appendChild(script)
    }, [])

    const cleanRef = ref.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
    const attrs = [
        theme === 'dark' && 'data-theme="dark"',
        style === 'inline' && startOnTickets && 'data-view="tickets"',
        cleanRef && `data-ref="${cleanRef}"`,
    ].filter(Boolean).join(' ')

    const loaderSnippet = useMemo(() => {
        const element = style === 'inline'
            ? `<div data-gatepass-event="${slug}"${attrs ? ' ' + attrs : ''}></div>`
            : `<button data-gatepass-button="${slug}"${attrs ? ' ' + attrs : ''}\n  style="padding:12px 22px;border:0;border-radius:999px;background:#111;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer">\n  Buy tickets\n</button>`
        return `${element}\n<script src="${origin}/embed.js" async></script>`
    }, [style, slug, attrs, origin])

    const iframeSnippet = useMemo(() => {
        const params = new URLSearchParams({
            ...(theme === 'dark' ? { theme: 'dark' } : {}),
            ...(startOnTickets ? { view: 'tickets' } : {}),
            ...(cleanRef ? { ref: cleanRef } : {}),
        }).toString()
        return `<iframe\n  src="${origin}/embed/${slug}${params ? '?' + params : ''}"\n  title="Tickets for ${event.title.replace(/"/g, '&quot;')}"\n  width="100%" height="700"\n  style="border:0;max-width:520px;display:block;margin:0 auto"\n  allow="payment"\n></iframe>`
    }, [origin, slug, theme, startOnTickets, cleanRef, event.title])

    const frameworkSnippet = (kind: 'react' | 'vue' | 'nuxt') => {
        const props = [
            `event="${slug}"`,
            theme === 'dark' && 'theme="dark"',
            style === 'inline' && startOnTickets && 'view="tickets"',
            cleanRef && `referral="${cleanRef}"`,
        ].filter(Boolean).join(' ')
        const tag = style === 'inline' ? `<GatePassWidget ${props} />` : `<GatePassButton ${props}>Buy tickets</GatePassButton>`
        if (kind === 'react') return `import { ${style === 'inline' ? 'GatePassWidget' : 'GatePassButton'} } from '@gatepass/react'\n\nexport function Tickets() {\n  return ${tag}\n}`
        if (kind === 'vue') return `<!-- main.ts: app.use(GatePass) from '@gatepass/vue' -->\n<template>\n  ${tag}\n</template>`
        return `<!-- nuxt.config.ts: modules: ['@gatepass/nuxt'] -->\n<template>\n  ${tag}\n</template>`
    }

    const current = PLATFORMS.find(p => p.id === platform)!
    const snippet = current.snippet === 'iframe' ? iframeSnippet
        : current.snippet === 'loader' ? loaderSnippet
            : frameworkSnippet(current.snippet)

    const trackingSnippet = `<script>
  window.addEventListener('gatepass:checkout_started', function (e) {
    // e.detail → { event, amount, currency, tickets }
  });
  window.addEventListener('gatepass:purchase_completed', function (e) {
    // Free orders complete in the widget. Paid orders finish on GatePass after payment.
  });
</script>`

    const copy = async (text: string, key: string) => {
        await navigator.clipboard.writeText(text)
        setCopied(key)
        toast.success('Copied')
        setTimeout(() => setCopied(null), 1500)
    }

    const pill = (active: boolean) => `rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${active
        ? 'bg-gray-950 text-white dark:bg-white dark:text-black'
        : 'text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white'}`

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Sell on your website</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Add checkout to any site with one snippet. Buyers never leave your page until they pay, and the widget always matches this event.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
                <div className="space-y-6">
                    <section className="space-y-5 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
                        <h3 className="text-base font-semibold text-gray-950 dark:text-white">Appearance</h3>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-950 dark:text-white">Style</p>
                                <div className="inline-flex rounded-full border border-gray-200 p-1 dark:border-white/10" role="group" aria-label="Widget style">
                                    <button type="button" aria-pressed={style === 'inline'} onClick={() => setStyle('inline')} className={pill(style === 'inline')}>Inline widget</button>
                                    <button type="button" aria-pressed={style === 'button'} onClick={() => setStyle('button')} className={pill(style === 'button')}>Button</button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{style === 'inline' ? 'Sits in your page and sizes itself to fit.' : 'Opens checkout in a pop-up over your page.'}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-950 dark:text-white">Theme</p>
                                <div className="inline-flex rounded-full border border-gray-200 p-1 dark:border-white/10" role="group" aria-label="Theme">
                                    <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')} className={pill(theme === 'light')}>Light</button>
                                    <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} className={pill(theme === 'dark')}>Dark</button>
                                </div>
                            </div>
                        </div>
                        {style === 'inline' && (
                            <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-white/10">
                                <label htmlFor="embed-start-tickets" className="text-sm text-gray-700 dark:text-gray-300">Open on ticket selection</label>
                                <Switch id="embed-start-tickets" label="Open on ticket selection" checked={startOnTickets} onChange={setStartOnTickets} />
                            </div>
                        )}
                        <div className="space-y-2 border-t border-gray-100 pt-5 dark:border-white/10">
                            <label htmlFor="embed-ref" className="flex items-baseline justify-between text-sm font-medium text-gray-950 dark:text-white">Referral tag <span className="text-xs font-normal text-gray-400">Optional</span></label>
                            <input id="embed-ref" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. venue-website" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-950 outline-none focus:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">Shows up as a source in Marketing, so you can see which site sold what.</p>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 p-3 dark:border-white/10" role="tablist" aria-label="Platform">
                            {PLATFORMS.map(p => (
                                <button key={p.id} type="button" role="tab" aria-selected={platform === p.id} onClick={() => setPlatform(p.id)} className={`shrink-0 ${pill(platform === p.id)}`}>{p.label}</button>
                            ))}
                        </div>
                        <div className="space-y-5 p-5 sm:p-7">
                            <ol className="space-y-2">
                                {current.steps.map((step, i) => (
                                    <li key={step} className="grid grid-cols-[1.75rem_1fr] text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                        <span className="font-mono text-xs leading-6 text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                                        {/^npm install/.test(step) ? <code className="font-mono text-[13px] text-gray-950 dark:text-white">{step}</code> : <span>{step}</span>}
                                    </li>
                                ))}
                            </ol>
                            {current.snippet === 'iframe' && style === 'button' && (
                                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">The pop-up button needs the script, so this shows the inline iframe instead.</p>
                            )}
                            <div className="relative">
                                <pre className="max-h-[260px] overflow-auto rounded-2xl bg-gray-950 p-4 pr-14 font-mono text-[12px] leading-relaxed text-gray-100"><code>{snippet}</code></pre>
                                <button type="button" onClick={() => copy(snippet, 'snippet')} aria-label="Copy code" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                                    {copied === 'snippet' ? <Check className="size-4" /> : <Copy className="size-4" />}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
                        <div>
                            <h3 className="text-base font-semibold text-gray-950 dark:text-white">For developers</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track checkouts in your own analytics, open checkout from code, or read event data.</p>
                        </div>
                        <div className="relative">
                            <pre className="overflow-auto rounded-2xl bg-gray-950 p-4 pr-14 font-mono text-[12px] leading-relaxed text-gray-100"><code>{trackingSnippet}</code></pre>
                            <button type="button" onClick={() => copy(trackingSnippet, 'tracking')} aria-label="Copy tracking code" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                                {copied === 'tracking' ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </button>
                        </div>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-white/10">GatePass.open(&apos;{slug}&apos;)</code> opens checkout from any click handler.</li>
                            <li className="flex flex-wrap items-center gap-1.5">
                                Event data as JSON:
                                <a href={`${origin}/api/v1/events/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-gray-950 underline underline-offset-4 dark:text-white">
                                    /api/v1/events/{slug} <ExternalLink className="size-3.5" aria-hidden="true" />
                                </a>
                            </li>
                        </ul>
                    </section>
                </div>

                <section className="space-y-3 xl:sticky xl:top-6 xl:self-start">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-950 dark:text-white">Live preview</h3>
                        <a href={`${origin}/embed/${slug}${theme === 'dark' ? '?theme=dark' : ''}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white">
                            Open <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                    </div>
                    <div className={`flex min-h-[280px] items-start justify-center rounded-3xl border border-gray-200 p-6 dark:border-white/10 ${theme === 'dark' ? 'bg-zinc-950' : 'bg-[#f3f1ec]'}`}>
                        {/* Keyed so the loader mounts a fresh widget whenever the options change */}
                        {style === 'inline' ? (
                            <div key={`inline-${theme}-${startOnTickets}`} className="w-full overflow-hidden rounded-2xl" data-gatepass-event={slug} {...(theme === 'dark' ? { 'data-theme': 'dark' } : {})} {...(startOnTickets ? { 'data-view': 'tickets' } : {})} />
                        ) : (
                            <div className="flex w-full flex-col items-center gap-3 py-16 text-center">
                                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>Your page</p>
                                <button key={`button-${theme}`} type="button" data-gatepass-button={slug} {...(theme === 'dark' ? { 'data-theme': 'dark' } : {})} style={{ padding: '12px 22px', border: 0, borderRadius: 999, background: theme === 'dark' ? '#fff' : '#111', color: theme === 'dark' ? '#111' : '#fff', font: '600 15px system-ui, sans-serif', cursor: 'pointer' }}>
                                    Buy tickets
                                </button>
                                <p className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'}`}>Click to try the pop-up</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}
