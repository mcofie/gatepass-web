import React, { useState } from 'react'
import { Plus, X, Image as ImageIcon, Trash2, Edit2, Loader2, Package, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { EventAddon } from '@/types/gatepass'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

interface AddonsTabProps {
    addons: EventAddon[]
    eventId: string
    organizationId: string
    onUpdate: () => void
}

export function AddonsTab({ addons, eventId, organizationId, onUpdate }: AddonsTabProps) {
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
        selection_type: 'quantity'
    })

    const resetForm = () => {
        setForm({
            name: '',
            description: '',
            price: 0,
            currency: 'GHS',
            image_url: '',
            is_active: true,
            selection_type: 'quantity'
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
                        selection_type: form.selection_type
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
                        selection_type: form.selection_type || 'quantity'
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
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={resetForm} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Add-on' : 'New Add-on'}</h3>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Basic Info Card */}
                    <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Name</label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-medium text-gray-900 dark:text-white"
                                placeholder="e.g. VIP Parking Pass"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Price (GHS)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={form.price}
                                onChange={e => setForm({ ...form, price: parseFloat(e.target.value) })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-mono font-medium text-gray-900 dark:text-white"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Description</label>
                            <textarea
                                value={form.description || ''}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all font-medium text-gray-900 dark:text-white min-h-[100px]"
                                placeholder="Describe the item..."
                            />
                        </div>
                    </div>

                    {/* Selection Type Card */}
                    <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">Selection Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, selection_type: 'quantity' })}
                                className={cn(
                                    "p-4 rounded-2xl border text-left transition-all",
                                    form.selection_type === 'quantity'
                                        ? "border-black dark:border-white bg-black/5 dark:bg-white/5 ring-1 ring-black dark:ring-white shadow-sm"
                                        : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 bg-gray-50/50 dark:bg-transparent"
                                )}
                            >
                                <div className="font-bold text-sm mb-1 text-gray-900 dark:text-white flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5" />
                                    Quantity
                                </div>
                                <div className="text-[11px] text-gray-500 leading-tight">Allow guests to buy multiple (e.g. Drinks, Merch)</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, selection_type: 'toggle' })}
                                className={cn(
                                    "p-4 rounded-2xl border text-left transition-all",
                                    form.selection_type === 'toggle'
                                        ? "border-black dark:border-white bg-black/5 dark:bg-white/5 ring-1 ring-black dark:ring-white shadow-sm"
                                        : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 bg-gray-50/50 dark:bg-transparent"
                                )}
                            >
                                <div className="font-bold text-sm mb-1 text-gray-900 dark:text-white flex items-center gap-2">
                                    <Check className="w-3.5 h-3.5" />
                                    Toggle
                                </div>
                                <div className="text-[11px] text-gray-500 leading-tight">Single selection (0 or 1) only.</div>
                            </button>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4 block flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Display Image
                        </label>
                        <div className="w-40 mx-auto">
                            <MediaUploader
                                type="image"
                                path={`${organizationId}/addons`}
                                value={form.image_url || ''}
                                onChange={(url) => setForm({ ...form, image_url: url })}
                                aspectRatio="square"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="flex-1 h-12 rounded-xl border border-gray-200 dark:border-white/10 font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? 'Save Changes' : 'Create Add-on')}
                        </button>
                    </div>
                </form >
            </div >
        )
    }

    // LIST VIEW
    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Empty State */}
            {addons.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-[#111] rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.02)]">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100 dark:border-white/5">
                        <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">No Add-ons Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8 text-sm leading-relaxed">
                        Enhance your event revenue by selling merchandise, parking passes, or upgrades alongside your tickets.
                    </p>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="h-12 px-8 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold inline-flex items-center gap-2 hover:scale-105 transition-transform shadow-xl shadow-black/10 dark:shadow-white/5"
                    >
                        <Plus className="w-4 h-4" />
                        Create First Add-on
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <h3 className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight">Active Add-ons</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Manage merchandise and upgrades</p>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="h-11 px-6 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm inline-flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/10 dark:shadow-white/5 hover:-translate-y-0.5"
                        >
                            <Plus className="w-4 h-4" />
                            New Item
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {addons.map(addon => (
                            <div key={addon.id} className="group bg-white dark:bg-[#111] p-5 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all flex flex-col md:flex-row gap-6 items-start md:items-center">
                                {/* Image */}
                                <div className="w-full md:w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-2xl flex-shrink-0 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                                    {addon.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={addon.image_url} alt={addon.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
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
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
                                            addon.selection_type === 'toggle'
                                                ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
                                                : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                                        )}>
                                            {addon.selection_type === 'toggle' ? 'Single Choice' : 'Multi-Quantity'}
                                        </span>
                                    </div>

                                    {addon.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 font-medium">{addon.description}</p>
                                    )}

                                    <div className="flex items-center gap-4 mt-2">
                                        <p className="font-bold text-lg text-gray-900 dark:text-white">
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
                                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pl-0 md:pl-6 border-l-0 md:border-l border-gray-100 dark:border-white/10 md:h-16 justify-end">
                                    <button
                                        onClick={() => startEdit(addon)}
                                        className="h-10 px-5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center gap-2 border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(addon.id)}
                                        className="h-10 w-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
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
