'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { syncUserTeamMemberships } from '@/app/actions/team'
import { GatePassMark } from '@/components/branding/GatePassMark'

type View = 'LOGIN' | 'SENT' | 'MANUAL'
type Intent = 'buyer' | 'organizer'

const fieldClass = 'h-12 w-full rounded-xl border border-[#d8d8d8] bg-white px-4 text-[15px] text-black outline-none transition-colors placeholder:text-[#919191] focus:border-black focus:ring-2 focus:ring-black/10 dark:border-[#3b3b3b] dark:bg-[#111] dark:text-white dark:placeholder:text-[#777] dark:focus:border-white dark:focus:ring-white/10'
const labelClass = 'mb-2 block text-[13px] font-semibold text-[#262626] dark:text-[#e9e9e9]'
const primaryClass = 'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5] dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#080808]'
const textButtonClass = 'text-[13px] font-semibold text-[#4d4d4d] underline decoration-[#bcbcbc] underline-offset-4 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:text-[#bcbcbc] dark:hover:text-white dark:focus-visible:ring-white'

export function LoginContent() {
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [view, setView] = useState<View>('LOGIN')
    const [intent, setIntent] = useState<Intent>('buyer')
    const [errorMessage, setErrorMessage] = useState('')
    const searchParams = useSearchParams()
    const requestedPath = searchParams.get('next') || searchParams.get('redirect') || ''
    const urlTarget = requestedPath.startsWith('/') && !requestedPath.startsWith('//') && !requestedPath.includes('\\') ? requestedPath : ''
    const actualPath = urlTarget || (intent === 'organizer' ? '/dashboard' : '/my-tickets')
    const supabase = createClient()

    const sendLoginLink = async () => {
        setErrorMessage('')
        setLoading(true)

        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
            const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: baseUrl + '/auth/callback?next=' + encodeURIComponent(actualPath),
                },
            })
            if (error) throw error

            setOtp('')
            setView('SENT')
            toast.success('Sign-in email sent')
        } catch (error: unknown) {
            const authError = error as { message?: string; code?: string }
            const message = authError.message?.includes('Error sending magic link email') || authError.code === 'unexpected_failure'
                ? 'We could not send another email right now. Please try again shortly.'
                : authError.message || 'Something went wrong. Please try again.'
            setErrorMessage(message)
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        await sendLoginLink()
    }

    const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (otp.length !== 6) {
            setErrorMessage('Enter the 6-digit code from your email.')
            return
        }
        if (!email.trim()) {
            setErrorMessage('Enter your email address.')
            return
        }

        setErrorMessage('')
        setVerifying(true)
        try {
            let result = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otp,
                type: 'email',
            })

            if (result.error?.message?.toLowerCase().includes('expired') || result.error?.message?.toLowerCase().includes('invalid')) {
                const retry = await supabase.auth.verifyOtp({
                    email: email.trim(),
                    token: otp,
                    type: 'magiclink',
                })
                if (!retry.error) result = retry
            }

            if (result.error) throw result.error

            try {
                const syncResult = await syncUserTeamMemberships()
                if (!urlTarget && syncResult.success && syncResult.hasTeamMembership) {
                    toast.success('Signed in')
                    window.location.href = '/dashboard?login=success'
                    return
                }
            } catch (syncError) {
                console.error('Failed to sync team memberships:', syncError)
            }

            toast.success('Signed in')
            window.location.href = actualPath
        } catch (error: unknown) {
            const verifyError = error as { message?: string }
            const message = verifyError.message || 'That code did not work. Please try again.'
            setErrorMessage(message)
            toast.error(message)
        } finally {
            setVerifying(false)
        }
    }

    const changeEmail = () => {
        setView('LOGIN')
        setOtp('')
        setErrorMessage('')
    }

    return (
        <div className="flex min-h-svh flex-col bg-white text-black dark:bg-[#080808] dark:text-white">
            <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
                <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white" aria-label="GatePass home">
                    <GatePassMark />
                    <span className="text-[17px] font-bold tracking-[-0.04em]">GatePass</span>
                </Link>
                <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4b4b4b] transition-colors hover:text-black focus-visible:outline-none focus-visible:underline dark:text-[#bbb] dark:hover:text-white">
                    Explore events <ArrowUpRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </Link>
            </header>

            <main className="mx-auto grid w-full max-w-[1180px] flex-1 items-center gap-12 px-5 pb-14 pt-8 sm:px-8 md:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:gap-24 lg:pt-0">
                <div className="hidden lg:block">
                    <h1 className="max-w-[610px] text-[clamp(3.5rem,5.2vw,5rem)] font-semibold leading-[1.02] tracking-[-0.065em]">
                        One sign-in.<br />Every event.
                    </h1>
                    <p className="mt-6 max-w-[440px] text-[17px] leading-[1.6] text-[#646464] dark:text-[#aaa]">
                        Access your tickets and the events you manage, all in one place.
                    </p>
                </div>

                <div className="w-full max-w-[440px] justify-self-center lg:max-w-none">
                    <div className="mb-7 lg:hidden">
                        <h1 className="text-[36px] font-semibold leading-[1.04] tracking-[-0.055em] sm:text-[42px]">One sign-in.<br />Every event.</h1>
                    </div>

                    <div className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-8 lg:p-9 dark:border-[#2b2b2b] dark:bg-[#101010]">
                        <div>
                            {view === 'LOGIN' ? (
                                <div>
                                    <div className="mb-7">
                                        <h2 className="text-[27px] font-semibold tracking-[-0.045em]">Sign in</h2>
                                        <p className="mt-1.5 text-[14px] leading-6 text-[#6b6b6b] dark:text-[#aaa]">{urlTarget ? 'Enter your email to continue securely.' : 'Choose where you\'re going, then enter your email.'}</p>
                                    </div>

                                    <form onSubmit={handleAuth} className="space-y-5">
                                        {!urlTarget && (
                                            <fieldset>
                                                <legend className={labelClass}>Sign in for</legend>
                                                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sign-in destination">
                                                    <button
                                                        type="button"
                                                        aria-pressed={intent === 'buyer'}
                                                        onClick={() => setIntent('buyer')}
                                                        className={'h-11 rounded-xl border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ' + (intent === 'buyer' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-[#dedede] bg-white text-[#555] hover:border-[#888] dark:border-[#3b3b3b] dark:bg-[#101010] dark:text-[#bbb]')}
                                                    >My tickets</button>
                                                    <button
                                                        type="button"
                                                        aria-pressed={intent === 'organizer'}
                                                        onClick={() => setIntent('organizer')}
                                                        className={'h-11 rounded-xl border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ' + (intent === 'organizer' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-[#dedede] bg-white text-[#555] hover:border-[#888] dark:border-[#3b3b3b] dark:bg-[#101010] dark:text-[#bbb]')}
                                                    >Manage events</button>
                                                </div>
                                            </fieldset>
                                        )}
                                        <div>
                                            <label htmlFor="login-email" className={labelClass}>Email address</label>
                                            <input
                                                id="login-email"
                                                value={email}
                                                onChange={(event) => { setEmail(event.target.value); setErrorMessage('') }}
                                                type="email"
                                                autoComplete="email"
                                                required
                                                placeholder="you@example.com"
                                                className={fieldClass}
                                            />
                                        </div>
                                        {errorMessage && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">{errorMessage}</p>}
                                        <button type="submit" disabled={loading} className={primaryClass}>
                                            {loading ? <Loader2 className="size-4 animate-spin" aria-label="Sending email" /> : <>Continue with email <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" /></>}
                                        </button>
                                    </form>
                                    <p className="mt-4 text-[13px] leading-5 text-[#777] dark:text-[#999]">We&apos;ll email you a sign-in link and a 6-digit code. No password needed.</p>
                                    <div className="mt-7 border-t border-[#ececec] pt-5 dark:border-[#303030]">
                                        <button type="button" onClick={() => { setView('MANUAL'); setErrorMessage('') }} className={textButtonClass}>I already have a code</button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <button type="button" onClick={changeEmail} className="mb-7 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-[#666] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:text-[#aaa] dark:hover:text-white dark:focus-visible:ring-white">
                                        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden="true" /> Back
                                    </button>
                                    <div className="mb-7">
                                        {view === 'SENT' && <span className="mb-5 flex size-10 items-center justify-center rounded-full bg-[#f2f2f2] dark:bg-[#242424]"><Check className="size-5" strokeWidth={1.8} aria-hidden="true" /></span>}
                                        <h2 className="text-[27px] font-semibold tracking-[-0.045em]">{view === 'SENT' ? 'Check your email' : 'Enter your code'}</h2>
                                        <p className="mt-1.5 text-[14px] leading-6 text-[#6b6b6b] dark:text-[#aaa]">
                                            {view === 'SENT' ? 'Use the sign-in link in your email, or enter the 6-digit code here.' : 'Enter the email address and 6-digit code from your GatePass message.'}
                                        </p>
                                    </div>

                                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                                        {view === 'SENT' ? (
                                            <div>
                                                <span className={labelClass}>Email address</span>
                                                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] px-4 dark:border-[#343434] dark:bg-[#171717]">
                                                    <span className="min-w-0 truncate text-[14px] font-medium">{email}</span>
                                                    <button type="button" onClick={changeEmail} className={textButtonClass}>Edit</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label htmlFor="code-email" className={labelClass}>Email address</label>
                                                <input
                                                    id="code-email"
                                                    value={email}
                                                    onChange={(event) => { setEmail(event.target.value); setErrorMessage('') }}
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    placeholder="you@example.com"
                                                    className={fieldClass}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label htmlFor="login-code" className={labelClass}>6-digit code</label>
                                            <input
                                                id="login-code"
                                                value={otp}
                                                onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrorMessage('') }}
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={6}
                                                required
                                                placeholder="000000"
                                                className={fieldClass + ' text-center text-[20px] font-semibold tracking-[0.32em] tabular-nums placeholder:tracking-[0.32em]'}
                                            />
                                        </div>
                                        {errorMessage && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">{errorMessage}</p>}
                                        <button type="submit" disabled={verifying || otp.length !== 6 || !email.trim()} className={primaryClass}>
                                            {verifying ? <Loader2 className="size-4 animate-spin" aria-label="Verifying code" /> : <>Verify and sign in <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" /></>}
                                        </button>
                                    </form>
                                    {view === 'SENT' && (
                                        <p className="mt-6 text-[13px] text-[#777] dark:text-[#999]">
                                            Didn&apos;t receive it?{' '}
                                            <button type="button" disabled={loading} onClick={sendLoginLink} className={textButtonClass + ' disabled:opacity-50'}>{loading ? 'Sending…' : 'Resend email'}</button>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <footer className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 border-t border-[#ededed] px-5 py-5 text-[12px] text-[#777] sm:px-8 dark:border-[#252525] dark:text-[#999]">
                <span>© {new Date().getFullYear()} GatePass</span>
                <nav aria-label="Legal and support" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link href="/terms-of-service" className="hover:text-black focus-visible:underline dark:hover:text-white">Terms</Link>
                    <Link href="/privacy-policy" className="hover:text-black focus-visible:underline dark:hover:text-white">Privacy</Link>
                    <a href="mailto:support@gatepass.so" className="hover:text-black focus-visible:underline dark:hover:text-white">Support</a>
                </nav>
            </footer>
        </div>
    )
}
