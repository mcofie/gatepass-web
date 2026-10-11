import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Keep the social preview mark in step with app/icon.svg.
const markSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 646 646"><rect width="646" height="646" rx="145" fill="#000"/><path fill="#fff" transform="rotate(45 323 323)" d="M336 124c107 0 169 54 169 119 0 67-40 104-117 120-42 9-62 28-78 65l-17 40c-16 38-34 55-64 55-41 0-66-36-79-93-8-37-9-74-9-113 0-123 60-193 195-193Z"/></svg>'

export const ogMarkSrc = `data:image/svg+xml,${encodeURIComponent(markSvg)}`

let fontsPromise: Promise<[
    { name: string; data: ArrayBuffer; weight: 400; style: 'normal' },
    { name: string; data: ArrayBuffer; weight: 700; style: 'normal' },
]> | undefined

export function loadOgFonts() {
    fontsPromise ??= Promise.all([
        readFile(join(process.cwd(), 'public/fonts/Geist-Regular.ttf')),
        readFile(join(process.cwd(), 'public/fonts/Geist-Bold.ttf')),
    ]).then(([regular, bold]) => [
        { name: 'Geist', data: Uint8Array.from(regular).buffer as ArrayBuffer, weight: 400, style: 'normal' },
        { name: 'Geist', data: Uint8Array.from(bold).buffer as ArrayBuffer, weight: 700, style: 'normal' },
    ])
    return fontsPromise
}
