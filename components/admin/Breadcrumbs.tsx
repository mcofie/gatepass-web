'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

export function Breadcrumbs() {
    const pathname = usePathname()
    const paths = pathname.split('/').filter(Boolean)

    // Don't show on main admin dashboard
    if (pathname === '/admin') return null

    return (
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 w-fit">
            <Link
                href="/admin"
                className="hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
            >
                <Home className="w-3 h-3" />
                Admin
            </Link>

            {paths.slice(1).map((path, index) => {
                const href = `/${paths.slice(0, index + 2).join('/')}`
                const isLast = index === paths.slice(1).length - 1
                const label = path.replace(/-/g, ' ')

                return (
                    <React.Fragment key={path}>
                        <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
                        {isLast ? (
                            <span className="text-gray-900 dark:text-white truncate max-w-[150px]">
                                {label}
                            </span>
                        ) : (
                            <Link
                                href={href}
                                className="hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                {label}
                            </Link>
                        )}
                    </React.Fragment>
                )
            })}
        </nav>
    )
}
