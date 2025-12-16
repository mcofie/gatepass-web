import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <h1 className="text-[120px] font-black leading-none tracking-tighter text-gray-100 dark:text-zinc-900 select-none">
                404
            </h1>
            <div className="-mt-8 relative z-10">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Page Not Found</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8 leading-relaxed">
                    The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                </p>

                <Link href="/">
                    <button className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-black/10 dark:shadow-white/10">
                        Back to Home
                    </button>
                </Link>
            </div>
        </div>
    )
}
