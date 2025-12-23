import React, { useState } from 'react'
import { Plus, X, Image as ImageIcon, Trash2, Edit2, Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { EventAddon } from '@/types/gatepass'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { formatCurrency } from '@/utils/format'

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
        is_active: true
    })

    const resetForm = () => {
        setForm({
            name: '',
            description: '',
            price: 0,
            currency: 'GHS',
            image_url: '',
            is_active: true
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
                        is_active: form.is_active
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
                        is_active: true
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
                </form>
            </div>
        )
    }

    // LIST VIEW
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header / Empty State */}
            {addons.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#111] rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Add-ons Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                        Sell merchandise, parking passes, or upgrades alongside your event tickets.
                    </p>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="h-11 px-6 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold inline-flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                        <Plus className="w-4 h-4" />
                        Create First Add-on
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white">Active Add-ons</h3>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="h-10 px-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            <Plus className="w-4 h-4" />
                            New Item
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {addons.map(addon => (
                            <div key={addon.id} className="group bg-white dark:bg-[#111] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex gap-4">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-xl flex-shrink-0 relative overflow-hidden">
                                    {addon.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={addon.image_url} alt={addon.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="font-bold text-gray-900 dark:text-white truncate">{addon.name}</h4>
                                            <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(addon.price, addon.currency)}</span>
                                        </div>
                                        {addon.description && <p className="text-xs text-gray-500 line-clamp-1 mt-1">{addon.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <button
                                            onClick={() => startEdit(addon)}
                                            className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
                                        <button
                                            onClick={() => handleDelete(addon.id)}
                                            className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                        <div className="flex-1" />
                                        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-lg">
                                            {addon.quantity_sold} Sold
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
