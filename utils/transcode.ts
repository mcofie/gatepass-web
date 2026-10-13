// Event videos are compressed in the browser before upload, so only the small result is stored.
// ffmpeg.wasm and its core are loaded on demand: they're large and only needed in the event editor.

export type OptimizedVideo = {
    blob: Blob
    extension: 'mp4'
    contentType: 'video/mp4'
    width: number
    height: number
    orientation: 'portrait' | 'landscape' | 'square'
}

// Background loops don't need more than 720p-class detail; this keeps files a few MB.
const MAX_LONG_SIDE = 1280
const MAX_SECONDS = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
export class VideoTranscoder {
    private ffmpeg: any = null
    private fetchFile: any = null
    private loading: Promise<void> | null = null

    load(): Promise<void> {
        if (!this.loading) {
            this.loading = (async () => {
                const [{ FFmpeg }, util] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
                this.fetchFile = util.fetchFile
                this.ffmpeg = new FFmpeg()
                // Single-threaded core: works without cross-origin isolation headers.
                // The core is loaded as blob URLs, and the worker is served unbundled from /public:
                // bundling it breaks its dynamic import of the core ("expression is too dynamic").
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
                const [coreURL, wasmURL] = await Promise.all([
                    util.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    util.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                ])
                await this.ffmpeg.load({ coreURL, wasmURL, classWorkerURL: `${window.location.origin}/ffmpeg/0.12.15/worker.js` })
            })().catch(error => {
                this.loading = null
                throw error
            })
        }
        return this.loading
    }

    /**
     * H.264/AAC MP4 that plays everywhere (including iOS), keeps the source orientation,
     * caps the long side at 1280px and 30fps, and starts playing before it's fully downloaded.
     */
    async optimize(file: File, onProgress?: (percent: number) => void): Promise<OptimizedVideo> {
        await this.load()
        const ffmpeg = this.ffmpeg
        const input = `input${extensionOf(file.name)}`
        const output = 'output.mp4'

        await ffmpeg.writeFile(input, await this.fetchFile(file))
        const progress = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100))))
        ffmpeg.on('progress', progress)

        try {
            await ffmpeg.exec([
                '-i', input,
                '-t', String(MAX_SECONDS),
                // Shrink only if larger; -2 keeps the other side even and the aspect ratio intact
                '-vf', `scale='if(gte(iw,ih),min(${MAX_LONG_SIDE},iw),-2)':'if(gte(iw,ih),-2,min(${MAX_LONG_SIDE},ih))',fps=30`,
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-crf', '28',
                '-profile:v', 'main',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '96k',
                '-ac', '2',
                '-movflags', '+faststart',
                output,
            ])
            const data = await ffmpeg.readFile(output)
            const blob = new Blob([data], { type: 'video/mp4' })
            const { width, height } = await dimensionsOf(blob)
            return {
                blob,
                extension: 'mp4',
                contentType: 'video/mp4',
                width,
                height,
                orientation: width === height ? 'square' : width > height ? 'landscape' : 'portrait',
            }
        } finally {
            ffmpeg.off('progress', progress)
            await ffmpeg.deleteFile(input).catch(() => {})
            await ffmpeg.deleteFile(output).catch(() => {})
        }
    }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extensionOf(filename: string) {
    const dot = filename.lastIndexOf('.')
    return dot > 0 ? filename.slice(dot) : ''
}

function dimensionsOf(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob)
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
            resolve({ width: video.videoWidth, height: video.videoHeight })
            URL.revokeObjectURL(url)
        }
        video.onerror = () => {
            resolve({ width: 0, height: 0 })
            URL.revokeObjectURL(url)
        }
        video.src = url
    })
}

export const transcoder = new VideoTranscoder()
