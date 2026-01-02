import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function AuthCodeErrorPage(props: {
    searchParams: SearchParams | Promise<SearchParams>
}) {
    const params = await props.searchParams
    const error = params?.error as string | undefined
    const code = params?.error_code as string | undefined
    const description = params?.error_description as string | undefined

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] dark:bg-[#050505] font-sans px-6 relative overflow-hidden">
            {/* Subtle Textured Background */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 dark:brightness-100" />

            <div className="w-full max-w-md z-10 text-center">
                <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                <h1 className="text-2xl font-semibold text-black dark:text-white mb-3">
                    Authentication Error
                </h1>

                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    {description ||
                        (error ? `Error: ${error}` : "We couldn't log you in using that link. It may be invalid or expired.")}
                </p>

                {code && (
                    <div className="mb-8 p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800 text-xs font-mono text-gray-500">
                        Error Code: {code}
                    </div>
                )}

                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black dark:bg-white text-white dark:text-black font-medium text-[15px] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Try Again
                </Link>
            </div>
        </div>
    )
}
