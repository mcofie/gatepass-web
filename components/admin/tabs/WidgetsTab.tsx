import React, { useState } from 'react'
import { Event } from '@/types/gatepass'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/dashboard/ui'

interface WidgetsTabProps {
    event: Event
}

export function WidgetsTab({ event }: WidgetsTabProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [startOnTickets, setStartOnTickets] = useState(false)
    const [copied, setCopied] = useState(false)

    // Construct the embed URL
    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so'

    const embedUrl = `${baseUrl}/embed/${event.slug || event.id}`
    // Only non-default options go in the URL to keep the snippet clean
    const query = new URLSearchParams({
        ...(theme === 'dark' ? { theme: 'dark' } : {}),
        ...(startOnTickets ? { view: 'tickets' } : {}),
    }).toString()
    const codeSrc = query ? `${embedUrl}?${query}` : embedUrl
    const previewUrl = codeSrc

    const iframeCode = `<iframe
  src="${codeSrc}"
  width="100%"
  height="680"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"
></iframe>`

    const handleCopy = () => {
        navigator.clipboard.writeText(iframeCode)
        setCopied(true)
        toast.success("Embed code copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
    }

    const handleOpenPreview = () => {
        window.open(previewUrl, '_blank')
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left Side: Instructions & Code */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                            Embed checkout
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Add ticket checkout to your website with the code below.
                        </p>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                        <h3 className="text-base font-semibold text-gray-950 dark:text-white">Appearance</h3>

                        {/* Theme Toggle */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
                            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5">
                                <button
                                    onClick={() => setTheme('light')}
                                    aria-pressed={theme === 'light'}
                                    className={cn(
                                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                        theme === 'light'
                                            ? "bg-white text-black dark:bg-zinc-800 dark:text-white"
                                            : "text-gray-500 hover:text-black dark:hover:text-white"
                                    )}
                                >
                                    Light
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    aria-pressed={theme === 'dark'}
                                    className={cn(
                                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                        theme === 'dark'
                                            ? "bg-black text-white dark:bg-white dark:text-black"
                                            : "text-gray-500 hover:text-black dark:hover:text-white"
                                    )}
                                >
                                    Dark
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <label htmlFor="embed-start-tickets" className="text-sm text-gray-600 dark:text-gray-400">Open on ticket selection</label>
                            <Switch id="embed-start-tickets" label="Open on ticket selection" checked={startOnTickets} onChange={setStartOnTickets} />
                        </div>

                        <div className="h-px w-full bg-gray-100 dark:bg-white/10" />

                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-950 dark:text-white">Embed code</h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400">HTML</span>
                        </div>

                        <div>
                            <pre className="min-h-[120px] overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                                {iframeCode}
                            </pre>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                                onClick={handleCopy}
                                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied' : 'Copy code'}
                            </button>
                            <button
                                onClick={handleOpenPreview}
                                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open preview
                            </button>
                        </div>
                    </div>

                    <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">Use a container at least 350px wide for the best checkout experience.</p>
                </div>

                {/* Right Side: Visual Preview */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">Live preview</h3>
                    <div className="flex min-h-[500px] flex-1 items-start justify-center rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5 sm:p-6">
                        <div className="pointer-events-none w-full max-w-[400px] select-none">
                            <iframe
                                src={previewUrl}
                                width="100%"
                                height="680"
                                frameBorder="0"
                                className="rounded-xl bg-white"
                                style={{ pointerEvents: 'none' }}
                            />
                        </div>
                    </div>
                    <p className="text-center text-xs text-gray-500 dark:text-gray-400">Preview uses this event’s colors and content.</p>
                </div>
            </div>
        </div>
    )
}
