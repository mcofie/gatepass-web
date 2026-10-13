'use client'

import React, { useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, FileVideo, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { transcoder } from '@/utils/transcode'

interface MediaUploaderProps {
    value?: string
    onChange: (url: string) => void
    bucket?: string
    path: string
    type: 'image' | 'video'
    maxSizeMB?: number // Default 300 for video (compressed before upload), 5 for image
    className?: string
    disabled?: boolean
    label?: string
    compact?: boolean
}

export function MediaUploader({
    value,
    onChange,
    bucket = 'event-media',
    path,
    type,
    maxSizeMB = type === 'video' ? 300 : 5,
    className,
    aspectRatio = 'video',
    disabled = false,
    label,
    compact = false,
    expectOrientation,
}: MediaUploaderProps & {
    aspectRatio?: 'video' | 'square' | 'portrait' | 'auto'
    /** For orientation-specific video slots: warn when the clip doesn't match */
    expectOrientation?: 'landscape' | 'portrait'
}) {
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

            // Videos are compressed in the browser first; only the small MP4 is uploaded
            if (type === 'video') {
                setIsTranscoding(true)
                try {
                    const optimized = await transcoder.optimize(file, pct => setProgress(pct))
                    fileToUpload = new File([optimized.blob], file.name.replace(/\.[^/.]+$/, '') + '.mp4', { type: optimized.contentType })
                    fileExt = optimized.extension
                    contentType = optimized.contentType
                    const savedPct = Math.max(0, Math.round((1 - optimized.blob.size / file.size) * 100))
                    toast.success(`Video optimized (${optimized.orientation}, ${(optimized.blob.size / 1024 / 1024).toFixed(1)} MB${savedPct ? `, ${savedPct}% smaller` : ''})`)
                    if (expectOrientation && optimized.orientation !== expectOrientation && optimized.orientation !== 'square') {
                        toast.warning(`This clip is ${optimized.orientation}. It’ll still play, with bars around it. A ${expectOrientation} cut fills the screen.`)
                    }
                    setProgress(0)
                } catch (e) {
                    console.error('Transcode error', e)
                    // Large originals would exceed the storage upload limit, so only small files fall back
                    if (file.size > 45 * 1024 * 1024) throw new Error('Couldn\u2019t optimize this video. Try a shorter clip or export it as MP4 under 45 MB.')
                    toast.warning('Couldn\u2019t optimize this video, uploading the original.')
                } finally {
                    setIsTranscoding(false)
                }
            }

            // Upload Logic
            const timestamp = new Date().getTime()
            const fileName = `${path}/${timestamp}-${crypto.randomUUID()}.${fileExt}`

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
                        referrerPolicy="no-referrer"
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
                            type="button"
                            aria-label="Remove uploaded image"
                            onClick={() => onChange('')}
                            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg bg-black/75 text-white transition-colors hover:bg-black"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )
        }

        return (
            <div className="relative group w-full h-full bg-black rounded-xl overflow-hidden">
                <video src={value} className="w-full h-full object-contain" controls playsInline preload="metadata" />
                {!disabled && (
                    <button
                        type="button"
                        aria-label="Remove uploaded video"
                        onClick={() => onChange('')}
                        className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/75 text-white transition-colors hover:bg-black"
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
                    "relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-white/10",
                    aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'portrait' ? 'aspect-[9/16]' : ''
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
                    onKeyDown={(event) => {
                        if (!disabled && !isUploading && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault()
                            fileInputRef.current?.click()
                        }
                    }}
                    role="button"
                    tabIndex={disabled || isUploading ? -1 : 0}
                    aria-label={label || `Upload ${type === 'video' ? 'video' : 'cover image'}`}
                    className={clsx(
                        "group relative flex w-full flex-col items-center justify-center overflow-hidden border border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white",
                        'rounded-xl',
                        aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'portrait' ? 'aspect-[9/16]' : '',
                        isDragging ? "border-black bg-gray-50 dark:border-white dark:bg-white/10" : "border-gray-200 bg-gray-50/40 hover:border-gray-400 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/30",
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

                    {isUploading && compact ? (
                        <Loader2 className="size-5 animate-spin text-gray-500" aria-label="Uploading" />
                    ) : isUploading ? (
                        <div className="flex flex-col items-center gap-4 z-10 p-6 w-full max-w-xs text-center">
                            {isTranscoding ? (
                                <>
                                    <div className="relative">
                                        <Loader2 className="w-10 h-10 text-black dark:text-white animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold dark:text-white">{progress}%</div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Optimizing Video...</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compressing in your browser so it loads fast</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                                    <p className="font-medium text-gray-600 dark:text-gray-300">Uploading to cloud...</p>
                                </>
                            )}
                        </div>
                    ) : compact ? (
                        <div className="flex flex-col items-center gap-1.5 p-2 text-center">
                            <ImageIcon className="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                            <span className="text-[11px] font-medium leading-tight text-gray-700 dark:text-gray-200">
                                {isDragging ? 'Drop image' : label || 'Add image'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 p-6 text-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                                {type === 'video' ? <FileVideo className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {isDragging ? 'Drop to upload' : label || `Upload ${type === 'video' ? 'Video' : 'Cover'}`}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {type === 'video' ? (expectOrientation ? 'MP4, MOV or WebM · up to 300 MB' : 'MP4, MOV or WebM up to 300 MB · portrait or landscape') : 'JPG, PNG (max 5MB)'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
