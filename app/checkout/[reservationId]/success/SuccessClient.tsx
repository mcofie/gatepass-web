'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle, Calendar, MapPin, Ticket, ArrowRight, HelpCircle, Loader2 } from 'lucide-react'
import { EventFormQuestion, Reservation, Ticket as TicketType } from '@/types/gatepass'

interface SuccessClientProps {
    reservation: Reservation
    tickets: TicketType[]
    questions: EventFormQuestion[]
}

export function SuccessClient({ reservation, tickets = [], questions = [] }: SuccessClientProps) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [checkingResponses, setCheckingResponses] = useState(true)
    const [formSubmitted, setFormSubmitted] = useState(false)
    const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})

    const event = reservation?.events

    useEffect(() => {
        const checkExistingResponses = async () => {
            try {
                const { data } = await supabase
                    .schema('gatepass')
                    .from('event_form_responses')
                    .select('*')
                    .eq('reservation_id', reservation.id)
                
                if (data && data.length > 0) {
                    setFormSubmitted(true)
                }
            } catch (err) {
                console.error('Error checking responses:', err)
            } finally {
                setCheckingResponses(false)
            }
        }

        if (questions && questions.length > 0) {
            checkExistingResponses()
        } else {
            setCheckingResponses(false)
        }
    }, [reservation.id, questions, supabase])

    const handleInputChange = (questionId: string, value: string | boolean) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }))
        if (errors[questionId]) {
            setErrors(prev => {
                const updated = { ...prev }
                delete updated[questionId]
                return updated
            })
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}
        questions.forEach(q => {
            const answer = answers[q.id]
            if (q.required) {
                if (q.type === 'checkbox' && !answer) {
                    newErrors[q.id] = 'This field is required'
                } else if (q.type !== 'checkbox' && (answer === undefined || answer === null || String(answer).trim() === '')) {
                    newErrors[q.id] = 'This field is required'
                }
            }
        })
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateForm()) return

        setLoading(true)
        try {
            const responseData = questions.map(q => {
                let answerStr = ''
                if (q.type === 'checkbox') {
                    answerStr = answers[q.id] ? 'Yes' : 'No'
                } else {
                    answerStr = String(answers[q.id] || '').trim()
                }

                return {
                    reservation_id: reservation.id,
                    question_id: q.id,
                    answer: answerStr
                }
            })

            const { error } = await supabase
                .schema('gatepass')
                .from('event_form_responses')
                .insert(responseData)

            if (error) {
                console.error('Response submit error:', error)
                throw new Error(error.message)
            }

            setFormSubmitted(true)
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to submit responses'
            console.error('Error submitting form:', err)
            alert(`Error: ${errMsg}`)
        } finally {
            setLoading(false)
        }
    }

    const eventDate = event?.starts_at ? new Date(event.starts_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }) : ''

    const primaryColor = event?.primary_color || '#f59e0b'

    if (checkingResponses) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-zinc-500 mb-4" />
                <p className="text-sm text-zinc-400">Loading checkout success details...</p>
            </div>
        )
    }

    const showQuestionnaire = questions.length > 0 && !formSubmitted

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 select-none relative overflow-hidden flex flex-col items-center">
            {/* Ambient Background Glows */}
            <div 
                className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-15 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
            />
            <div 
                className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-10 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
            />

            <div className="w-full max-w-2xl relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Header Success Status */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                        <CheckCircle className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Order Confirmed!</h1>
                    <p className="text-zinc-400 text-lg">
                        Thank you for your purchase, <span className="text-white font-bold">{reservation.guest_name || 'Attendee'}</span>.
                    </p>
                    <p className="text-xs text-zinc-500 font-mono">
                        Order Ref: {reservation.id.substring(0, 8).toUpperCase()}
                    </p>
                </div>

                {/* Event Summary Banner */}
                {event && (
                    <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-[2rem] p-6 flex flex-col md:flex-row gap-6 items-center">
                        {event.poster_url && (
                            <div className="relative w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 border border-zinc-800">
                                <img 
                                    src={event.poster_url} 
                                    alt={event.title}
                                    className="object-cover w-full h-full"
                                />
                            </div>
                        )}
                        <div className="space-y-2 text-center md:text-left flex-grow">
                            <h2 className="text-xl font-bold tracking-tight">{event.title}</h2>
                            <div className="flex flex-col gap-1 text-sm text-zinc-400">
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Calendar className="w-4 h-4 text-zinc-500" />
                                    <span>{eventDate}</span>
                                </div>
                                {event.venue_name && (
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <MapPin className="w-4 h-4 text-zinc-500" />
                                        <span className="truncate max-w-[280px]">{event.venue_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Questionnaire Form */}
                {showQuestionnaire ? (
                    <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-[2rem] p-8 space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-zinc-400" />
                                Attendee Information Required
                            </h3>
                            <p className="text-sm text-zinc-400">
                                The event organizer is requesting some additional information regarding your tickets:
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {questions.map((q) => (
                                <div key={q.id} className="space-y-2">
                                    <label className="block text-sm font-bold text-zinc-300">
                                        {q.label}
                                        {q.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>

                                    {q.type === 'text' && (
                                        <input
                                            type="text"
                                            value={(answers[q.id] as string) || ''}
                                            onChange={(e) => handleInputChange(q.id, e.target.value)}
                                            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                                            placeholder="Your answer..."
                                        />
                                    )}

                                    {q.type === 'select' && (
                                        <div className="relative">
                                            <select
                                                value={(answers[q.id] as string) || ''}
                                                onChange={(e) => handleInputChange(q.id, e.target.value)}
                                                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 transition-all"
                                            >
                                                <option value="" className="bg-zinc-900 text-zinc-400">Select an option...</option>
                                                {q.options?.map((opt, oIdx) => (
                                                    <option key={oIdx} value={opt} className="bg-zinc-900 text-white">
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {q.type === 'checkbox' && (
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={!!answers[q.id]}
                                                onChange={(e) => handleInputChange(q.id, e.target.checked)}
                                                className="w-5 h-5 rounded border border-zinc-800 bg-zinc-950 checked:bg-zinc-500 focus:ring-0 cursor-pointer"
                                            />
                                            <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                                Yes, I agree / confirm
                                            </span>
                                        </label>
                                    )}

                                    {errors[q.id] && (
                                        <p className="text-xs text-red-500 font-medium">{errors[q.id]}</p>
                                    )}
                                </div>
                            ))}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all duration-200"
                                style={{ backgroundColor: primaryColor, color: '#000000' }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
                                        Submitting Details...
                                    </>
                                ) : (
                                    <>
                                        Submit Info & Get Tickets
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    /* Ticket Passes Downloads Block */
                    <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-[2rem] p-8 space-y-6">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Ticket className="w-5 h-5 text-zinc-400" />
                                Your Ticket Passes
                            </h3>
                            <p className="text-sm text-zinc-400">
                                Your payment has been processed. Access your ticket passes below:
                            </p>
                        </div>

                        <div className="divide-y divide-zinc-800">
                            {tickets.map((t) => (
                                <div key={t.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-sm text-zinc-200">
                                            {t.ticket_tiers?.name || 'Admission Pass'}
                                        </h4>
                                        <p className="text-xs text-zinc-500 font-mono">
                                            #{t.id.substring(0, 8).toUpperCase()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/ticket/${t.id}`}
                                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            View Pass
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Back home buttons */}
                        <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
                            <Link
                                href="/"
                                className="w-full py-3.5 bg-white text-black hover:bg-zinc-200 text-center rounded-xl text-xs font-extrabold transition-all"
                            >
                                Go to Homepage
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
