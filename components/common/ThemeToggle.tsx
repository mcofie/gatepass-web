"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)

    // useEffect only runs on the client, so now we can safely show the UI
    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="w-9 h-9" /> // Placeholder to prevent hydration mismatch
    }

    const toggleOpen = () => setIsOpen(!isOpen)

    return (
        <div className="relative">
            <button
                onClick={toggleOpen}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border border-gray-200 dark:border-white/10 shadow-sm"
                aria-label="Toggle theme"
            >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-gray-500 dark:text-gray-400" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-gray-500 dark:text-gray-400" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-32 rounded-xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 shadow-lg z-50 overflow-hidden py-1 animate-scale-in origin-top-right">
                        <button
                            onClick={() => { setTheme("light"); setIsOpen(false) }}
                            className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${theme === 'light' ? 'text-black dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Sun className="h-3.5 w-3.5" />
                            <span>Light</span>
                        </button>
                        <button
                            onClick={() => { setTheme("dark"); setIsOpen(false) }}
                            className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${theme === 'dark' ? 'text-black dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Moon className="h-3.5 w-3.5" />
                            <span>Dark</span>
                        </button>
                        <button
                            onClick={() => { setTheme("system"); setIsOpen(false) }}
                            className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${theme === 'system' ? 'text-black dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Laptop className="h-3.5 w-3.5" />
                            <span>System</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
