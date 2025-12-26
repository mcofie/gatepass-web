'use client'

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={() => onOpenChange(false)}
            />

            {/* Content Container - handled by DialogContent */}
            {children}
        </div>
    )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    className?: string
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
    // We assume this is wrapped in Dialog which handles the backdrop
    // We need to inject the close handler context if we want a close button, 
    // but for now we'll just render.

    return (
        <div
            className={cn(
                "relative z-50 w-full bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-800 p-6 animate-in zoom-in-95 duration-200 sm:rounded-xl",
                className
            )}
            {...props}
        >
            {children}
            {/* We could add a close button here if we had access to the state setter */}
        </div>
    )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
    )
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
    )
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p className={cn("text-sm text-gray-500 dark:text-gray-400", className)} {...props} />
    )
}
