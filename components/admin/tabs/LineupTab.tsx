import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { LineupItem } from '@/types/gatepass'
import { MediaUploader } from '@/components/admin/MediaUploader'

interface LineupTabProps {
    lineup: LineupItem[]
    onChange: (lineup: LineupItem[]) => void
    organizationId: string
}

export function LineupTab({ lineup, onChange, organizationId }: LineupTabProps) {
    const [isAddingLineup, setIsAddingLineup] = useState(false)
    const [newLineupItem, setNewLineupItem] = useState<LineupItem>({ name: '', role: '' })

    const addLineupItem = () => {
        if (!newLineupItem.name || !newLineupItem.role) return
        onChange([...(lineup || []), newLineupItem])
        setNewLineupItem({ name: '', role: '' })
        setIsAddingLineup(false)
    }

    const removeLineupItem = (index: number) => {
        const updated = [...(lineup || [])]
        updated.splice(index, 1)
        onChange(updated)
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start gap-8">
                {/* List */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Current Lineup</div>
                        <button
                            onClick={() => setIsAddingLineup(true)}
                            className="text-xs font-bold text-black dark:text-white hover:underline flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Add Artist
                        </button>
                    </div>

                    {(lineup || []).length === 0 ? (
                        <div className="p-8 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">No artists added yet.</p>
                            <button onClick={() => setIsAddingLineup(true)} className="mt-2 text-sm font-bold text-black dark:text-white hover:underline">Add One</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {(lineup || []).map((item, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 group">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden shrink-0">
                                        {item.image_url ? (
                                            <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                                                {item.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">{item.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.role}</div>
                                    </div>
                                    <button
                                        onClick={() => removeLineupItem(index)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add Form */}
                {isAddingLineup && (
                    <div className="w-80 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl space-y-4">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">Add Performer</h4>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                            <input
                                value={newLineupItem.name}
                                onChange={e => setNewLineupItem(p => ({ ...p, name: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                                placeholder="Artist Name"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
                            <input
                                value={newLineupItem.role}
                                onChange={e => setNewLineupItem(p => ({ ...p, role: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                                placeholder="DJ, Host, etc."
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Photo</label>
                            <div className="mt-1">
                                <MediaUploader
                                    type="image"
                                    path={`${organizationId}/lineup/${Math.random().toString(36).substring(7)}`}
                                    value={newLineupItem.image_url || ''}
                                    onChange={url => setNewLineupItem(p => ({ ...p, image_url: url }))}
                                    className="!h-32"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsAddingLineup(false)}
                                className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addLineupItem}
                                className="flex-1 py-2 text-xs font-bold bg-black dark:bg-white text-white dark:text-black rounded-lg"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
