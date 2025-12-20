import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex flex-col items-center justify-center p-6 relative font-sans overflow-hidden">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-50/50 via-white to-white dark:from-zinc-900/30 dark:via-black dark:to-black pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-1000">

                {/* 404 Graphic */}
                <div className="relative mb-8 md:mb-12">
                    <h1 className="text-[140px] md:text-[200px] font-bold leading-none tracking-tighter text-black/5 dark:text-white/5 select-none">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-px h-16 md:h-24 bg-black/10 dark:bg-white/10" />
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    <h2 className="text-xl md:text-2xl font-medium tracking-tight text-gray-900 dark:text-white">
                        Page not found
                    </h2>
                    <p className="text-[15px] text-gray-500 dark:text-gray-400 font-normal leading-relaxed text-balance px-4">
                        The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
                    </p>

                    <div className="pt-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[14px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-black/5 dark:shadow-white/5 border border-transparent dark:border-white/10"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer Copyright */}
            <div className="absolute bottom-8 text-[11px] text-gray-300 dark:text-zinc-800 uppercase tracking-widest font-medium">
                GatePass Experience
            </div>
        </div>
    )
}
