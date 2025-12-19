'use client'

import React, { useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Upload, X, FileVideo, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { transcoder } from '@/utils/transcode'

interface MediaUploaderProps {
    value?: string
    onChange: (url: string) => void
    bucket?: string
    path: string
    type: 'image' | 'video'
    maxSizeMB?: number // Default 50 for video, 5 for image
    className?: string
    disabled?: boolean
}

export function MediaUploader({
    value,
    onChange,
    bucket = 'event-media',
    path,
    type,
    maxSizeMB = type === 'video' ? 50 : 5,
    className,
    aspectRatio = 'video',
    disabled = false
}: MediaUploaderProps & { aspectRatio?: 'video' | 'square' | 'auto' }) {
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isTranscoding, setIsTranscoding] = useState(false)
    const [progress, setProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true)
        } else if (e.type === 'dragleave') {
            setIsDragging(false)
        }
    }, [])

    const validateFile = (file: File) => {
        // specific video types for better mobile compatibility check?
        const validTypes = type === 'video'
            ? ['video/mp4', 'video/quicktime', 'video/webm']
            : ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

        if (!validTypes.includes(file.type)) {
            toast.error(`Invalid file type. Accepted: ${validTypes.map(t => t.split('/')[1]).join(', ')}`)
            return false
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            toast.error(`File too large. Max size: ${maxSizeMB}MB`)
            return false
        }

        return true
    }

    const processUpload = async (file: File) => {
        try {
            setIsUploading(true)
            setProgress(0)

            let fileToUpload = file
            let fileExt = file.name.split('.').pop()
            let contentType = file.type

            // Video Transcoding Logic
            if (type === 'video' && file.type !== 'video/webm') {
                setIsTranscoding(true)
                try {
                    toast.info('Optimizing video for web... This may take a minute.')
                    const blob = await transcoder.convertToWebM(file, (pct) => {
                        setProgress(pct)
                    })
                    fileToUpload = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webm", { type: 'video/webm' })
                    fileExt = 'webm'
                    contentType = 'video/webm'
                    setIsTranscoding(false)
                    setProgress(0) // Reset for upload phase
                } catch (e) {
                    console.error('Transcode error', e)
                    toast.error('Failed to optimize video. Uploading original.')
                    setIsTranscoding(false)
                    // Fallback to original
                }
            }

            // Upload Logic
            const timestamp = new Date().getTime()
            const fileName = `${path}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, fileToUpload, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: contentType
                })

            if (error) throw error

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName)

            console.log('[MediaUploader] Uploaded file public URL:', publicUrl)

            onChange(publicUrl)
            toast.success('Upload complete!')

        } catch (error: any) {
            console.error('Upload error:', error)
            toast.error(error.message || 'Upload failed')
        } finally {
            setIsUploading(false)
            setIsTranscoding(false)
            setProgress(0)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            if (validateFile(file)) {
                processUpload(file)
            }
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            if (validateFile(file)) {
                processUpload(file)
            }
        }
    }

    // Preview Component
    const renderPreview = () => {
        if (!value) return null

        if (type === 'image') {
            if (!path) {
                console.warn('[MediaUploader] Warning: path prop is empty or undefined')
            }
            return (
                <div className="relative group w-full h-full">
                    <img
                        src={value}
                        alt="Preview"
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                            console.error('[MediaUploader] Image failed to load:', value)
                            e.currentTarget.style.display = 'none'
                        }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-500 text-xs font-mono break-all p-4" style={{ display: 'none' }} ref={(el) => { if (el && el.previousElementSibling && (el.previousElementSibling as HTMLImageElement).style.display === 'none') el.style.display = 'flex' }}>
                        Failed to load: {value}
                    </div>
                    {!disabled && (
                        <button
                            onClick={() => onChange('')}
                            className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )
        }

        return (
            <div className="relative group w-full h-full bg-black rounded-xl overflow-hidden">
                <video src={value} className="w-full h-full object-cover" controls crossOrigin="anonymous" />
                {!disabled && (
                    <button
                        onClick={() => onChange('')}
                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className={clsx("w-full transition-all", className)}>
            {value ? (
                <div className={clsx(
                    "w-full rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden relative shadow-sm hover:shadow-md transition-shadow",
                    aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : ''
                )}>
                    {renderPreview()}
                </div>
            ) : (
                <div
                    onDragEnter={!disabled ? handleDrag : undefined}
                    onDragLeave={!disabled ? handleDrag : undefined}
                    onDragOver={!disabled ? handleDrag : undefined}
                    onDrop={!disabled ? handleDrop : undefined}
                    onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
                    className={clsx(
                        "w-full rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 group relative overflow-hidden",
                        aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : '',
                        isDragging ? "border-black dark:border-white bg-gray-50 dark:bg-white/10 scale-[1.02]" : "border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30 hover:bg-gray-50/50 dark:hover:bg-white/5",
                        (isUploading || disabled) && "pointer-events-none opacity-80"
                    )}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept={type === 'video' ? "video/mp4,video/quicktime,video/webm" : "image/*"}
                        onChange={handleFileSelect}
                    />

                    {isUploading ? (
                        <div className="flex flex-col items-center gap-4 z-10 p-6 w-full max-w-xs text-center">
                            {isTranscoding ? (
                                <>
                                    <div className="relative">
                                        <Loader2 className="w-10 h-10 text-black dark:text-white animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold dark:text-white">{progress}%</div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Optimizing Video...</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Converting to WebM for best performance</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                                    <p className="font-medium text-gray-600 dark:text-gray-300">Uploading to cloud...</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-center p-6 group-hover:scale-105 transition-transform duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors">
                                {type === 'video' ? <FileVideo className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">
                                    {isDragging ? 'Drop to upload' : `Upload ${type === 'video' ? 'Video' : 'Cover'}`}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                    {type === 'video' ? 'MP4, MOV (max 50MB)' : 'JPG, PNG (max 5MB)'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
