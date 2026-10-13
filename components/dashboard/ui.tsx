import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shared building blocks for dashboard pages, so every section has the same rhythm:
// eyebrow + headline intro, rounded-3xl panels, pill buttons, and quiet helper text.

export function SectionIntro({ eyebrow, title, description, action, id }: {
    eyebrow?: string
    title: string
    description?: React.ReactNode
    action?: React.ReactNode
    id?: string
}) {
    return (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
                {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{eyebrow}</p>}
                <h2 id={id} className="text-[28px] font-semibold leading-tight tracking-tight text-gray-950 dark:text-white sm:text-[34px]">{title}</h2>
                {description && <p className="max-w-xl text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
            </div>
            {action}
        </header>
    )
}

export function Panel({ title, description, children, footer, className }: {
    title?: string
    description?: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    className?: string
}) {
    return (
        <section className={cn('overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]', className)}>
            {(title || description) && (
                <div className="px-5 pt-5 sm:px-7 sm:pt-7">
                    {title && <h3 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h3>}
                    {description && <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
                </div>
            )}
            <div className="p-5 sm:p-7">{children}</div>
            {footer && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/10 sm:px-7">{footer}</div>
            )}
        </section>
    )
}

export const inputClass =
    'h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-[15px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white dark:focus:border-white/60 dark:disabled:bg-white/5'

export const textareaClass = cn(inputClass, 'h-auto min-h-[104px] resize-y py-3 leading-relaxed')

export function Field({ label, htmlFor, hint, optional, children, className }: {
    label: string
    htmlFor?: string
    hint?: React.ReactNode
    optional?: boolean
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('space-y-2', className)}>
            <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-medium text-gray-950 dark:text-white">
                {label}
                {optional && <span className="text-xs font-normal text-gray-400">Optional</span>}
            </label>
            {children}
            {hint && <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
    )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; size?: 'md' | 'sm' }

export function PrimaryButton({ loading, size = 'md', className, children, disabled, ...props }: ButtonProps) {
    return (
        <button
            {...props}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-full bg-gray-950 font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black',
                size === 'md' ? 'h-11 px-6 text-sm' : 'h-9 px-4 text-[13px]',
                className,
            )}
        >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {children}
        </button>
    )
}

export function SecondaryButton({ loading, size = 'md', className, children, disabled, ...props }: ButtonProps) {
    return (
        <button
            {...props}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white font-medium text-gray-950 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5',
                size === 'md' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-[13px]',
                className,
            )}
        >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {children}
        </button>
    )
}

export function Notice({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'danger' }) {
    return (
        <p className={cn('rounded-2xl px-4 py-3 text-sm leading-relaxed', {
            'bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300': tone === 'neutral',
            'bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200': tone === 'warning',
            'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300': tone === 'danger',
        })}>
            {children}
        </p>
    )
}

export function Switch({ checked, onChange, disabled, label, id }: {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    label: string
    id?: string
}) {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black',
                checked ? 'bg-gray-950 dark:bg-white' : 'bg-gray-200 dark:bg-white/15',
            )}
        >
            <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform dark:bg-black', checked ? 'translate-x-[22px]' : 'translate-x-0.5', !checked && 'dark:bg-white')} />
        </button>
    )
}
