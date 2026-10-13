import React, { useState } from 'react'
import { Plus, X, Image as ImageIcon, Trash2, Edit2, Loader2, Package, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { EventAddon, TicketTier } from '@/types/gatepass'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

interface AddonsTabProps {
    addons: EventAddon[]
    eventId: string
    organizationId: string
    onUpdate: () => void
    tiers: TicketTier[]
}

export function AddonsTab({ addons, eventId, organizationId, onUpdate, tiers }: AddonsTabProps) {
    const supabase = createClient()
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const [form, setForm] = useState<Partial<EventAddon>>({
        name: '',
        description: '',
        price: 0,
        currency: 'GHS',
        image_url: '',
        is_active: true,
        selection_type: 'quantity',
        tier_id: null
    })

    const resetForm = () => {
        setForm({
            name: '',
            description: '',
            price: 0,
            currency: 'GHS',
            image_url: '',
            is_active: true,
            selection_type: 'quantity',
            tier_id: null
        })
        setIsCreating(false)
        setEditingId(null)
    }

    const validateForm = () => {
        if (!form.name) {
            toast.error('Name is required')
            return false
        }
        if (form.price === undefined || form.price < 0) {
            toast.error('Valid price is required')
            return false
        }
        return true
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateForm()) return

        setLoading(true)
        try {
            if (editingId) {
                const { error } = await supabase
                    .schema('gatepass')
                    .from('event_addons')
                    .update({
                        name: form.name,
                        description: form.description,
                        price: form.price,
                        image_url: form.image_url,
                        is_active: form.is_active,
                        selection_type: form.selection_type,
                        tier_id: form.tier_id || null
                    })
                    .eq('id', editingId)

                if (error) throw error
                toast.success('Add-on updated successfully')
            } else {
                const { error } = await supabase
                    .schema('gatepass')
                    .from('event_addons')
                    .insert({
                        event_id: eventId,
                        name: form.name,
                        description: form.description,
                        price: form.price,
                        currency: 'GHS', // Default to GHS for now
                        image_url: form.image_url,
                        is_active: true,
                        selection_type: form.selection_type || 'quantity',
                        tier_id: form.tier_id || null
                    })

                if (error) throw error
                toast.success('Add-on created successfully')
            }
            onUpdate()
            resetForm()
        } catch (error: any) {
            console.error('Error saving addon:', error)
            toast.error(error.message || 'Failed to save add-on')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this add-on?')) return

        setLoading(true) // Global loading or local to item? Using global for simplicity here
        try {
            const { error } = await supabase
                .schema('gatepass')
                .from('event_addons')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Add-on deleted')
            onUpdate()
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete add-on')
        } finally {
            setLoading(false)
        }
    }

    const startEdit = (addon: EventAddon) => {
        setForm(addon)
        setEditingId(addon.id)
        setIsCreating(true)
    }

    if (isCreating) {
        return (
            <div className="max-w-2xl space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={resetForm} aria-label="Back to add-ons" className="rounded-lg border border-gray-200 p-2 transition-colors hover:border-gray-400 dark:border-white/10">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">{editingId ? 'Edit add-on' : 'New add-on'}</h2>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Basic Info Card */}
                    <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                        <div>
                            <label htmlFor="addon-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                            <input
                                id="addon-name"
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                placeholder="e.g. VIP Parking Pass"
                            />
                        </div>

                        <div>
                            <label htmlFor="addon-price" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Price (GHS)</label>
                            <input
                                id="addon-price"
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={form.price}
                                onChange={e => setForm({ ...form, price: parseFloat(e.target.value) })}
                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label htmlFor="addon-description" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                            <textarea
                                id="addon-description"
                                value={form.description || ''}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="min-h-24 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                placeholder="Describe the item..."
                            />
                        </div>

                        <div>
                            <label htmlFor="addon-tier" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Available with</label>
                            <div className="relative">
                                <select
                                    id="addon-tier"
                                    value={form.tier_id || ''}
                                    onChange={e => setForm({ ...form, tier_id: e.target.value || null })}
                                    className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                >
                                    <option value="">All ticket types</option>
                                    {tiers.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                Limit this item to one ticket type, or offer it to everyone.
                            </p>
                        </div>
                    </div>

                    {/* Selection Type Card */}
                    <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">How guests select it</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, selection_type: 'quantity' })}
                                aria-pressed={form.selection_type === 'quantity'}
                                className={cn(
                                    "rounded-xl border p-4 text-left transition-colors",
                                    form.selection_type === 'quantity'
                                        ? "border-black bg-gray-50 dark:border-white dark:bg-white/5"
                                        : "border-gray-200 hover:border-gray-400 dark:border-white/10 dark:hover:border-white/30"
                                )}
                            >
                                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    <Package className="w-3.5 h-3.5" />
                                    Quantity
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Guests can add more than one.</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, selection_type: 'toggle' })}
                                aria-pressed={form.selection_type === 'toggle'}
                                className={cn(
                                    "rounded-xl border p-4 text-left transition-colors",
                                    form.selection_type === 'toggle'
                                        ? "border-black bg-gray-50 dark:border-white dark:bg-white/5"
                                        : "border-gray-200 hover:border-gray-400 dark:border-white/10 dark:hover:border-white/30"
                                )}
                            >
                                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    <Check className="w-3.5 h-3.5" />
                                    Toggle
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Guests can add it once.</div>
                            </button>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-6">
                        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Image <span className="font-normal text-gray-400">Optional</span></p>
                        <div className="w-28">
                            <MediaUploader
                                type="image"
                                path={`${organizationId}/addons`}
                                value={form.image_url || ''}
                                onChange={(url) => setForm({ ...form, image_url: url })}
                                aspectRatio="square"
                                compact
                                label="Add image"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 dark:border-white/10 dark:text-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? 'Save add-on' : 'Create add-on')}
                        </button>
                    </div>
                </form >
            </div >
        )
    }

    // LIST VIEW
    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Header / Empty State */}
            {addons.length === 0 ? (
                <div className="rounded-3xl border border-gray-200 bg-white px-5 py-14 text-center dark:border-white/10 dark:bg-[#0b0b0b]">
                    <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/10">
                        <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No add-ons yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8 text-sm leading-relaxed">
                        Enhance your event revenue by selling merchandise, parking passes, or upgrades alongside your tickets.
                    </p>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
                    >
                        <Plus className="w-4 h-4" />
                        Add an item
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Add-ons</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage merchandise and upgrades.</p>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
                        >
                            <Plus className="w-4 h-4" />
                            Add item
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {addons.map(addon => (
                            <div key={addon.id} className="group grid grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#0b0b0b] sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center sm:p-5">
                                {/* Image */}
                                <div className="relative h-[72px] w-[72px] overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5 sm:h-20 sm:w-20">
                                    {addon.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={addon.image_url} alt={addon.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/20">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h4 className="font-bold text-lg text-gray-900 dark:text-white truncate">{addon.name}</h4>
                                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                            {addon.selection_type === 'toggle' ? 'Single choice' : 'Multiple'}
                                        </span>
                                        {addon.tier_id && (
                                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">
                                                For {tiers.find(t => t.id === addon.tier_id)?.name || 'ticket type'}
                                            </span>
                                        )}
                                    </div>

                                    {addon.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 font-medium">{addon.description}</p>
                                    )}

                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                        <p className="text-base font-semibold text-gray-950 dark:text-white">
                                            {formatCurrency(addon.price, addon.currency)}
                                        </p>
                                        <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
                                        <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                                            {addon.quantity_sold || 0} Sold
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="col-span-2 flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-white/10 sm:col-span-1 sm:border-0 sm:pt-0">
                                    <button
                                        onClick={() => startEdit(addon)}
                                        className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-black dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(addon.id)}
                                        aria-label={`Delete ${addon.name}`}
                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
