import { useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { clsx } from 'clsx'

interface DeleteEventModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    eventName: string
    isDeleting: boolean
}

export function DeleteEventModal({ isOpen, onClose, onConfirm, eventName, isDeleting }: DeleteEventModalProps) {
    const [confirmText, setConfirmText] = useState('')
    const isConfirmed = confirmText === 'DELETE'

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#111] w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 border border-transparent dark:border-white/10" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-red-100 dark:bg-red-500/10 rounded-2xl">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Event?</h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">
                        This action allows you to delete <span className="font-bold text-gray-900 dark:text-white">{eventName}</span>.
                        This action is irreversible and will permanently delete:
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            All ticket data and sales records
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Guest lists and attendee information
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Event page and public links
                        </li>
                    </ul>
                </div>

                {/* Confirmation Input */}
                <div className="mb-8 space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Type <span className="text-red-600 dark:text-red-500 select-all">DELETE</span> to confirm
                    </label>
                    <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full bg-gray-50 dark:bg-white/5 border-2 border-gray-100 dark:border-white/10 focus:border-red-500 dark:focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl p-3 outline-none font-bold text-gray-900 dark:text-white transition-all placeholder:font-medium placeholder:text-gray-400"
                    />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        disabled={!isConfirmed || isDeleting}
                        className={clsx(
                            "w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                            isConfirmed
                                ? "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-700 hover:-translate-y-0.5"
                                : "bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        )}
                    >
                        {isDeleting ? (
                            <>Processing...</>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Permanently Delete Event
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="w-full py-3.5 rounded-xl font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                    >
                        Cancel, keep event
                    </button>
                </div>

            </div>
        </div>
    )
}
