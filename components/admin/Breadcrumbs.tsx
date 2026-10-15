'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const isId = (segment: string) => /^[0-9a-f-]{20,}$/i.test(segment)

/** Admin › Events › Details: quiet trail above sub-pages; hidden on the overview. */
export function Breadcrumbs() {
    const pathname = usePathname()
    const paths = pathname.split('/').filter(Boolean)
    if (pathname === '/admin') return null

    return (
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400">
            <Link href="/admin" className="transition-colors hover:text-gray-950 dark:hover:text-white">Admin</Link>
            {paths.slice(1).map((segment, index) => {
                const href = `/${paths.slice(0, index + 2).join('/')}`
                const isLast = index === paths.length - 2
                const label = isId(segment) ? 'Details' : segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
                return (
                    <React.Fragment key={href}>
                        <ChevronRight className="size-3.5 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                        {isLast
                            ? <span aria-current="page" className="font-medium text-gray-950 dark:text-white">{label}</span>
                            : <Link href={href} className="transition-colors hover:text-gray-950 dark:hover:text-white">{label}</Link>}
                    </React.Fragment>
                )
            })}
        </nav>
    )
}
