'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, Check, AlertCircle, Info } from 'lucide-react'

// Types
export type ToastType = 'success' | 'error' | 'info'
export interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void
    removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// Hook
export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

// Provider
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(7)
        setToasts(prev => [...prev, { id, message, type }])

        // Auto remove
        setTimeout(() => removeToast(id), 4000)
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    )
}

// Container & Item
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>
    )
}

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: () => void }) => {
    const styles = {
        success: 'bg-black text-white border-black',
        error: 'bg-white text-red-600 border-red-100 shadow-xl',
        info: 'bg-white text-black border-gray-100 shadow-xl'
    }

    const icons = {
        success: <Check className="w-4 h-4" />,
        error: <AlertCircle className="w-4 h-4" />,
        info: <Info className="w-4 h-4" />
    }

    return (
        <div className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border w-[320px] 
            transition-all duration-300 animate-slide-up
            ${styles[toast.type]}
        `}>
            <div className="flex-shrink-0">{icons[toast.type]}</div>
            <p className="text-[13px] font-medium leading-snug flex-1">{toast.message}</p>
            <button
                onClick={onRemove}
                className="p-1 hover:opacity-50 transition-opacity flex-shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
