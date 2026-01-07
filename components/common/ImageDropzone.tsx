'use client'

import React, { useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'

interface ImageDropzoneProps {
    value: string | null
    onChange: (url: string | null) => void
    bucket?: string
    pathPrefix?: string
    placeholder?: string
    className?: string
}

export function ImageDropzone({
    value,
    onChange,
    bucket = 'public', // specific bucket if needed, defaults to public access usually
    pathPrefix = 'uploads',
    placeholder = 'Drag and drop an image, or click to browse',
    className = ''
}: ImageDropzoneProps) {
    const [dragActive, setDragActive] = useState(false)
    const [uploading, setUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleUpload(e.dataTransfer.files[0])
        }
    }

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (e.target.files && e.target.files[0]) {
            await handleUpload(e.target.files[0])
        }
    }

    const handleUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file')
            return
        }

        setUploading(true)
        const fileExt = file.name.split('.').pop()
        const fileName = `${pathPrefix}/${crypto.randomUUID()}.${fileExt}`

        try {
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName)

            onChange(publicUrl)
            toast.success('Image uploaded successfully')
        } catch (error: any) {
            console.error('Upload error:', error)
            toast.error('Error uploading image: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange(null)
    }

    const triggerSelect = () => {
        inputRef.current?.click()
    }

    // Preview Mode
    if (value) {
        return (
            <div className={`relative group w-full aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-50 ${className}`}>
                <img src={value} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button
                        type="button"
                        onClick={triggerSelect}
                        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                        title="Replace Image"
                    >
                        <Upload className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="p-3 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600/80 transition-colors"
                        title="Remove Image"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={handleChange}
                    accept="image/*"
                />
            </div>
        )
    }

    // Upload Mode
    return (
        <div
            className={`
                relative w-full aspect-video rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden
                ${dragActive
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
                }
                ${uploading ? 'pointer-events-none opacity-80' : ''}
                ${className}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerSelect}
        >
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleChange}
                accept="image/*"
            />

            {uploading ? (
                <>
                    <Loader2 className="w-8 h-8 text-black animate-spin" />
                    <p className="text-sm font-medium text-gray-500 animate-pulse">Uploading...</p>
                </>
            ) : (
                <>
                    <div className={`p-4 rounded-full bg-white shadow-sm border border-gray-100 transition-transform duration-300 ${dragActive ? 'scale-110' : ''}`}>
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
                    </div>
                </>
            )}

            {dragActive && (
                <div className="absolute inset-0 bg-black/5 pointer-events-none" />
            )}
        </div>
    )
}
