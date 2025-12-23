// import { FFmpeg } from '@ffmpeg/ffmpeg';
// import { fetchFile, toBlobURL } from '@ffmpeg/util';
// We use dynamic imports to avoid "expression is too dynamic" errors with Turbopack/Webpack
// and to ensure these heavy libraries are only loaded when needed.

export class VideoTranscoder {
    private ffmpeg: any = null; // Type as any to avoid complex type imports with dynamic loading
    private loaded = false;
    private fetchFile: any = null;
    private toBlobURL: any = null;

    async load() {
        if (this.loaded) return;

        console.log('Loading FFmpeg...');

        // Dynamically import the libraries
        const ffmpegModule = await import('@ffmpeg/ffmpeg');
        const utilModule = await import('@ffmpeg/util');

        this.fetchFile = utilModule.fetchFile;
        this.toBlobURL = utilModule.toBlobURL;

        const { FFmpeg } = ffmpegModule;
        this.ffmpeg = new FFmpeg();

        // Load ffmpeg.wasm from a CDN (Single-threaded for stability)
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        try {
            await this.ffmpeg.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
            });

            console.log('FFmpeg loaded successfully');
            this.loaded = true;
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw error;
        }
    }

    async convertToWebM(file: File, onProgress?: (progress: number) => void): Promise<Blob> {
        if (!this.loaded || !this.ffmpeg) {
            await this.load();
        }

        const ffmpeg = this.ffmpeg;
        const inputName = 'input' + getFileExtension(file.name);
        const outputName = 'output.webm';

        // Write file to FFmpeg FS
        await ffmpeg.writeFile(inputName, await this.fetchFile(file));

        // Track progress
        ffmpeg.on('progress', ({ progress }: any) => {
            if (onProgress) {
                // ffmpeg.wasm 0.12.x progress is 0-1
                onProgress(Math.round(progress * 100));
            }
        });

        // Run conversion
        // -c:v libvpx-vp9: Use VP9 codec for video (good quality/size ratio)
        // -b:v 1M: 1Mbps video bitrate target (adjustable for quality vs size)
        // -c:a libvorbis: Vorbis audio
        await ffmpeg.exec([
            '-i', inputName,
            '-c:v', 'libvpx-vp9',
            '-b:v', '1M',
            '-c:a', 'libvorbis',
            outputName
        ]);

        // Read result
        const data = await ffmpeg.readFile(outputName);

        // Cleanup
        try {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
        } catch (e) {
            console.warn('Cleanup error:', e);
        }

        return new Blob([data as any], { type: 'video/webm' });
    }
}

function getFileExtension(filename: string) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2) ?
        '.' + filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2) : '';
}

export const transcoder = new VideoTranscoder();
