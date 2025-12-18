import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class VideoTranscoder {
    private ffmpeg: FFmpeg | null = null;
    private loaded = false;

    async load() {
        if (this.loaded) return;

        this.ffmpeg = new FFmpeg();

        // Load ffmpeg.wasm from a CDN (Single-threaded for stability)
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        this.loaded = true;
    }

    async convertToWebM(file: File, onProgress?: (progress: number) => void): Promise<Blob> {
        if (!this.loaded || !this.ffmpeg) {
            await this.load();
        }

        const ffmpeg = this.ffmpeg!;
        const inputName = 'input' + getFileExtension(file.name);
        const outputName = 'output.webm';

        // Write file to FFmpeg FS
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Track progress
        ffmpeg.on('progress', ({ progress }) => {
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
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);

        return new Blob([data as any], { type: 'video/webm' });
    }
}

function getFileExtension(filename: string) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2) ?
        '.' + filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2) : '';
}

export const transcoder = new VideoTranscoder();
