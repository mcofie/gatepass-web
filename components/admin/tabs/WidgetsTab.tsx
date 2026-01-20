import React, { useState } from 'react'
import { Event } from '@/types/gatepass'
import { Copy, Check, ExternalLink, Code } from 'lucide-react'
import { toast } from 'sonner'

interface WidgetsTabProps {
    event: Event
}

export function WidgetsTab({ event }: WidgetsTabProps) {
    const [copied, setCopied] = useState(false)

    // Construct the embed URL
    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.io'

    const embedUrl = `${baseUrl}/embed/${event.slug || event.id}`

    // Construct the iframe code
    const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #eee; overflow: hidden;"
></iframe>`

    const handleCopy = () => {
        navigator.clipboard.writeText(iframeCode)
        setCopied(true)
        toast.success("Embed code copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
    }

    const handleOpenPreview = () => {
        window.open(embedUrl, '_blank')
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side: Instructions & Code */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Code className="w-6 h-6" />
                            Embedded Checkout
                        </h2>
                        <p className="mt-2 text-gray-500 dark:text-gray-400 leading-relaxed">
                            Sell tickets directly on your own website. Copy the code below and paste it into any HTML page or website builder (Wix, Squarespace, WordPress, etc.).
                        </p>
                    </div>

                    <div className="bg-white dark:bg-[#111] p-6 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Embed Code
                            </label>
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">
                                HTML / Iframe
                            </span>
                        </div>

                        <div className="relative group">
                            <pre className="bg-gray-50 dark:bg-black/50 text-gray-800 dark:text-gray-300 p-4 rounded-xl text-xs font-mono border border-gray-200 dark:border-white/10 overflow-x-auto whitespace-pre-wrap break-all min-h-[120px]">
                                {iframeCode}
                            </pre>
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={handleCopy}
                                    className="bg-black/80 hover:bg-black text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCopy}
                                className="flex-1 flex items-center justify-center gap-2 h-10 bg-black dark:bg-white text-white dark:text-black rounded-lg font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy Code'}
                            </button>
                            <button
                                onClick={handleOpenPreview}
                                className="flex-1 flex items-center justify-center gap-2 h-10 bg-white dark:bg-white/5 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Preview Widget
                            </button>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-500/20">
                        <h4 className="font-bold text-blue-900 dark:text-blue-400 text-sm mb-2">Technical Note</h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            The widget is fully responsive and will adapt to the width of its container.
                            We recommend a minimum width of 350px for the best experience.
                        </p>
                    </div>
                </div>

                {/* Right Side: Visual Preview */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Live Preview</h3>
                    <div className="flex-1 bg-gray-100 dark:bg-black/20 rounded-3xl border border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center p-8 min-h-[500px]">
                        <div className="w-full max-w-[400px] pointer-events-none select-none shadow-2xl">
                            <iframe
                                src={embedUrl}
                                width="100%"
                                height="600"
                                frameBorder="0"
                                className="rounded-2xl bg-white shadow-2xl"
                                style={{ pointerEvents: 'none' }}
                            />
                        </div>
                    </div>
                    <p className="text-center text-xs text-gray-400">
                        This is how the widget will appear on your site.
                    </p>
                </div>
            </div>
        </div>
    )
}
