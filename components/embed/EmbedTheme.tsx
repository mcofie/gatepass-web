'use client'

import { useLayoutEffect } from 'react'

/**
 * Embeds follow their ?theme= parameter, not the visitor's OS setting that the site-wide
 * theme provider applies to <html>. The inline script runs before first paint; the effect
 * keeps it that way if the provider re-applies the system theme later.
 */
export function EmbedTheme({ theme }: { theme: 'light' | 'dark' }) {
    useLayoutEffect(() => {
        const root = document.documentElement
        const apply = () => {
            root.classList.toggle('dark', theme === 'dark')
            root.style.colorScheme = theme
        }
        apply()
        const observer = new MutationObserver(() => {
            if (root.classList.contains('dark') !== (theme === 'dark')) apply()
        })
        observer.observe(root, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [theme])

    const script = `(function(){var r=document.documentElement;r.classList.toggle('dark',${theme === 'dark'});r.style.colorScheme='${theme}';})()`
    return <script dangerouslySetInnerHTML={{ __html: script }} />
}
