'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Pencil, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import type { EventFormQuestion } from '@/types/gatepass'
import { Field, Panel, PrimaryButton, SecondaryButton, Switch, inputClass } from '@/components/dashboard/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

type QuestionType = EventFormQuestion['type']

type ResponseRow = {
    id: string
    created_at: string
    answer: string | null
    question_id: string
    event_form_questions: { label: string } | null
    reservations: { id: string; guest_name: string | null; guest_email: string | null } | null
}

type Respondent = {
    id: string
    name: string
    email: string
    submittedAt: string
    answers: Record<string, string>
}

const TYPE_LABELS: Record<QuestionType, string> = { text: 'Free text', select: 'Multiple choice', checkbox: 'Yes or no' }
const EMPTY_QUESTION = { label: '', type: 'text' as QuestionType, options: '', required: false }

const iconButton = 'flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/5 dark:hover:text-white'

/** Questions asked after checkout, and the answers guests gave, grouped by guest. */
export function FormsTab({ eventId, eventSlug }: { eventId: string; eventSlug: string }) {
    const supabase = useMemo(() => createClient(), [])
    const [view, setView] = useState<'questions' | 'responses'>('questions')
    const [questions, setQuestions] = useState<EventFormQuestion[]>([])
    const [responses, setResponses] = useState<ResponseRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [form, setForm] = useState(EMPTY_QUESTION)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')

    const fetchQuestions = useCallback(async () => {
        const { data } = await supabase.schema('gatepass').from('event_form_questions').select('*').eq('event_id', eventId).order('sort_order', { ascending: true })
        if (data) setQuestions(data as EventFormQuestion[])
    }, [supabase, eventId])

    const fetchResponses = useCallback(async () => {
        const { data } = await supabase
            .schema('gatepass')
            .from('event_form_responses')
            .select('id, created_at, answer, question_id, event_form_questions!inner(label, event_id), reservations!inner(id, guest_name, guest_email)')
            .eq('event_form_questions.event_id', eventId)
            .order('created_at', { ascending: false })
        if (data) setResponses(data as unknown as ResponseRow[])
    }, [supabase, eventId])

    useEffect(() => {
        Promise.all([fetchQuestions(), fetchResponses()]).finally(() => setLoaded(true))
    }, [fetchQuestions, fetchResponses])

    const respondents = useMemo(() => {
        const byGuest = new Map<string, Respondent>()
        for (const r of responses) {
            const id = r.reservations?.id ?? r.id
            const entry = byGuest.get(id) ?? {
                id,
                name: r.reservations?.guest_name || 'Guest',
                email: r.reservations?.guest_email || '',
                submittedAt: r.created_at,
                answers: {},
            }
            entry.answers[r.question_id] = r.answer ?? ''
            byGuest.set(id, entry)
        }
        const query = search.toLowerCase().trim()
        return [...byGuest.values()].filter(g => !query
            || g.name.toLowerCase().includes(query)
            || g.email.toLowerCase().includes(query)
            || Object.values(g.answers).some(a => a.toLowerCase().includes(query)))
    }, [responses, search])

    const resetForm = () => {
        setForm(EMPTY_QUESTION)
        setEditingId(null)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const label = form.label.trim()
        if (!label) return toast.error('Write the question first')
        const options = form.type === 'select' ? form.options.split(',').map(s => s.trim()).filter(Boolean) : null
        if (form.type === 'select' && (!options || options.length < 2)) return toast.error('Add at least two choices, separated by commas')

        setSaving(true)
        try {
            const values = { label, type: form.type, options, required: form.required }
            const { error } = editingId
                ? await supabase.schema('gatepass').from('event_form_questions').update(values).eq('id', editingId)
                : await supabase.schema('gatepass').from('event_form_questions').insert({
                    ...values,
                    event_id: eventId,
                    sort_order: questions.length ? Math.max(...questions.map(q => q.sort_order)) + 1 : 0,
                })
            if (error) throw new Error(error.message)
            toast.success(editingId ? 'Question saved' : 'Question added')
            resetForm()
            await fetchQuestions()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save the question')
        } finally {
            setSaving(false)
        }
    }

    const startEdit = (q: EventFormQuestion) => {
        setEditingId(q.id)
        setForm({ label: q.label, type: q.type, options: q.options?.join(', ') ?? '', required: q.required })
        document.getElementById('question-label')?.focus()
    }

    const handleDelete = async (q: EventFormQuestion) => {
        if (!confirm(`Delete “${q.label}”? Answers already given to it are deleted too.`)) return
        const { error } = await supabase.schema('gatepass').from('event_form_questions').delete().eq('id', q.id)
        if (error) return toast.error(error.message)
        toast.success('Question deleted')
        if (editingId === q.id) resetForm()
        await Promise.all([fetchQuestions(), fetchResponses()])
    }

    const handleMove = async (index: number, direction: -1 | 1) => {
        const current = questions[index]
        const target = questions[index + direction]
        if (!current || !target) return
        // Optimistic swap so the list doesn't jump while saving
        const next = [...questions]
        next[index] = target
        next[index + direction] = current
        setQuestions(next)
        const [a, b] = await Promise.all([
            supabase.schema('gatepass').from('event_form_questions').update({ sort_order: target.sort_order }).eq('id', current.id),
            supabase.schema('gatepass').from('event_form_questions').update({ sort_order: current.sort_order }).eq('id', target.id),
        ])
        if (a.error || b.error) toast.error('Could not reorder questions')
        await fetchQuestions()
    }

    const handleExport = () => {
        if (respondents.length === 0) return
        const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
        const rows = [
            ['Name', 'Email', 'Submitted', ...questions.map(q => q.label)],
            ...respondents.map(g => [g.name, g.email, new Date(g.submittedAt).toLocaleString(), ...questions.map(q => g.answers[q.id] ?? '')]),
        ]
        const blob = new Blob([rows.map(row => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${eventSlug}-form-responses.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    const respondentCount = new Set(responses.map(r => r.reservations?.id ?? r.id)).size

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Forms</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ask guests for extra details after checkout, like sizes or dietary needs.</p>
                </div>
                <div role="tablist" aria-label="Forms" className="inline-flex rounded-full border border-gray-200 p-1 dark:border-white/10">
                    {([['questions', `Questions · ${questions.length}`], ['responses', `Responses · ${respondentCount}`]] as const).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={view === id}
                            onClick={() => setView(id)}
                            className={cn(
                                'h-8 rounded-full px-4 text-sm font-medium transition-colors',
                                view === id ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {view === 'questions' ? (
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                        {questions.length === 0 ? (
                            <EmptyState
                                illustration="form"
                                title={loaded ? 'No questions yet' : 'Loading questions'}
                                description={loaded ? 'Questions you add appear on the confirmation page, right after a guest checks out.' : undefined}
                            />
                        ) : (
                            <ol className="divide-y divide-gray-100 dark:divide-white/10">
                                {questions.map((q, index) => (
                                    <li key={q.id} className={cn('flex items-start gap-4 px-5 py-4 sm:px-6', editingId === q.id && 'bg-gray-50 dark:bg-white/5')}>
                                        <span className="mt-0.5 text-sm font-semibold tabular-nums text-gray-400">{String(index + 1).padStart(2, '0')}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[15px] font-medium text-gray-950 dark:text-white">{q.label}</p>
                                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                                {TYPE_LABELS[q.type]}{q.required ? ' · Required' : ' · Optional'}
                                                {q.options?.length ? ` · ${q.options.join(', ')}` : ''}
                                            </p>
                                        </div>
                                        <div className="-my-1 flex shrink-0 items-center">
                                            <button type="button" onClick={() => handleMove(index, -1)} disabled={index === 0} aria-label={`Move ${q.label} up`} className={cn(iconButton, 'hidden sm:flex')}>
                                                <ArrowUp className="size-4" aria-hidden="true" />
                                            </button>
                                            <button type="button" onClick={() => handleMove(index, 1)} disabled={index === questions.length - 1} aria-label={`Move ${q.label} down`} className={cn(iconButton, 'hidden sm:flex')}>
                                                <ArrowDown className="size-4" aria-hidden="true" />
                                            </button>
                                            <button type="button" onClick={() => startEdit(q)} aria-label={`Edit ${q.label}`} className={iconButton}>
                                                <Pencil className="size-4" aria-hidden="true" />
                                            </button>
                                            <button type="button" onClick={() => handleDelete(q)} aria-label={`Delete ${q.label}`} className={cn(iconButton, 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400')}>
                                                <Trash2 className="size-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    <form onSubmit={handleSave} className="lg:sticky lg:top-24">
                        <Panel
                            title={editingId ? 'Edit question' : 'Add a question'}
                            footer={
                                <>
                                    {editingId && <SecondaryButton type="button" size="sm" onClick={resetForm}>Cancel</SecondaryButton>}
                                    <PrimaryButton type="submit" size="sm" loading={saving}>{editingId ? 'Save question' : 'Add question'}</PrimaryButton>
                                </>
                            }
                        >
                            <div className="space-y-5">
                                <Field label="Question" htmlFor="question-label">
                                    <input id="question-label" required value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className={inputClass} placeholder="e.g. What’s your T-shirt size?" />
                                </Field>
                                <Field label="Answer type" htmlFor="question-type">
                                    <select id="question-type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as QuestionType })} className={inputClass}>
                                        {Object.entries(TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                    </select>
                                </Field>
                                {form.type === 'select' && (
                                    <Field label="Choices" htmlFor="question-options" hint="Separate choices with commas.">
                                        <input id="question-options" required value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} className={inputClass} placeholder="Small, Medium, Large" />
                                    </Field>
                                )}
                                <div className="flex items-center justify-between gap-4">
                                    <label htmlFor="question-required" className="text-sm font-medium text-gray-950 dark:text-white">Required</label>
                                    <Switch id="question-required" label="Required" checked={form.required} onChange={required => setForm({ ...form, required })} />
                                </div>
                            </div>
                        </Panel>
                    </form>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search names, emails or answers" aria-label="Search responses" className={cn(inputClass, 'rounded-full pl-10')} />
                        </div>
                        <SecondaryButton type="button" onClick={handleExport} disabled={respondents.length === 0}>
                            <Download className="size-4" aria-hidden="true" /> Export CSV
                        </SecondaryButton>
                    </div>

                    {respondents.length === 0 ? (
                        <div className="rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                            <EmptyState
                                illustration="form"
                                title={search ? 'No responses match' : 'No responses yet'}
                                description={search ? undefined : questions.length ? 'Answers show up here as guests fill in the form.' : 'Add a question first. Answers show up here.'}
                            />
                        </div>
                    ) : (
                        <ul className="grid gap-4 md:grid-cols-2">
                            {respondents.map(guest => (
                                <li key={guest.id} className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-[15px] font-semibold text-gray-950 dark:text-white">{guest.name}</p>
                                            {guest.email && <p className="truncate text-sm text-gray-500 dark:text-gray-400">{guest.email}</p>}
                                        </div>
                                        <time dateTime={guest.submittedAt} className="shrink-0 text-xs text-gray-400">
                                            {new Date(guest.submittedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                        </time>
                                    </div>
                                    <dl className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-white/10">
                                        {questions.filter(q => q.id in guest.answers).map(q => (
                                            <div key={q.id}>
                                                <dt className="text-xs text-gray-500 dark:text-gray-400">{q.label}</dt>
                                                <dd className="mt-0.5 break-words text-sm font-medium text-gray-950 dark:text-white">{guest.answers[q.id] || '—'}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}
