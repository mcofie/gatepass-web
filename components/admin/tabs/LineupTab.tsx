import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { LineupItem } from '@/types/gatepass'
import { MediaUploader } from '@/components/admin/MediaUploader'

interface LineupTabProps {
    lineup: LineupItem[]
    onChange: (lineup: LineupItem[]) => void
    organizationId: string
    disabled?: boolean
}

export function LineupTab({ lineup, onChange, organizationId, disabled = false }: LineupTabProps) {
    const [isAddingLineup, setIsAddingLineup] = useState(false)
    const [newLineupItem, setNewLineupItem] = useState<LineupItem>({ name: '', role: '' })

    const addLineupItem = (event: React.FormEvent) => {
        event.preventDefault()
        if (!newLineupItem.name.trim() || !newLineupItem.role.trim()) return
        onChange([...(lineup || []), { ...newLineupItem, name: newLineupItem.name.trim(), role: newLineupItem.role.trim() }])
        setNewLineupItem({ name: '', role: '' })
        setIsAddingLineup(false)
    }

    const removeLineupItem = (index: number) => {
        onChange((lineup || []).filter((_, itemIndex) => itemIndex !== index))
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">People on the lineup</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Artists, hosts and other featured guests.</p>
                </div>
                {!disabled && (
                    <button type="button" onClick={() => setIsAddingLineup(!isAddingLineup)} aria-expanded={isAddingLineup} className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 px-3 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400 dark:border-white/15 dark:text-white">
                        <Plus className="h-4 w-4" aria-hidden="true" /> Add person
                    </button>
                )}
            </div>

            {(lineup || []).length > 0 ? (
                <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
                    {lineup.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="flex items-center gap-3 px-4 py-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                                {item.image_url ? (
                                    <img src={item.image_url} className="h-full w-full object-cover" alt="" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400">{item.name.charAt(0)}</div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{item.name}</p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.role}</p>
                            </div>
                            {!disabled && (
                                <button type="button" onClick={() => removeLineupItem(index)} aria-label={`Remove ${item.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400">
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="rounded-xl border border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">No one has been added yet.</p>
            )}

            {isAddingLineup && !disabled && (
                <form onSubmit={addLineupItem} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/5 sm:p-5">
                    <h4 className="text-sm font-semibold text-gray-950 dark:text-white">Add to lineup</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="lineup-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                            <input id="lineup-name" required value={newLineupItem.name} onChange={e => setNewLineupItem(p => ({ ...p, name: e.target.value }))} className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white" placeholder="Artist or guest name" />
                        </div>
                        <div>
                            <label htmlFor="lineup-role" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                            <input id="lineup-role" required value={newLineupItem.role} onChange={e => setNewLineupItem(p => ({ ...p, role: e.target.value }))} className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-white/10 dark:bg-[#111] dark:text-white" placeholder="DJ, host, performer…" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Photo <span className="font-normal text-gray-400">Optional</span></p>
                        <MediaUploader type="image" path={`${organizationId}/lineup`} value={newLineupItem.image_url || ''} onChange={url => setNewLineupItem(p => ({ ...p, image_url: url }))} aspectRatio="square" compact className="!w-24" label="Add photo" />
                    </div>
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => { setIsAddingLineup(false); setNewLineupItem({ name: '', role: '' }) }} className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 dark:border-white/10 dark:text-gray-300">Cancel</button>
                        <button type="submit" className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white dark:bg-white dark:text-black">Add person</button>
                    </div>
                </form>
            )}
        </div>
    )
}
