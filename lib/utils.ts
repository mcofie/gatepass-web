import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getContrastColor(hexColor: string | undefined | null): string {
    if (!hexColor) return '#ffffff'

    // Remove hash if present
    const hex = hexColor.replace('#', '')

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    // Calculate YIQ brightness (human eye perception)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000

    // Return black for bright colors, white for dark colors
    // Threshold of 128 is standard, but 150 often feels better for modern UI
    return (yiq >= 150) ? '#000000' : '#ffffff'
}

export function getComplementaryColor(hexColor: string | undefined | null): string {
    if (!hexColor) return '#000000'
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }
    if (hex.length !== 6) return '#000000'
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    
    // Invert RGB components
    const compR = 255 - r
    const compG = 255 - g
    const compB = 255 - b
    
    const toHex = (c: number) => {
        const h = c.toString(16)
        return h.length === 1 ? '0' + h : h
    }
    return `#${toHex(compR)}${toHex(compG)}${toHex(compB)}`
}
