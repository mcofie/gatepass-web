import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM. INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes, base64 encoded:
//   openssl rand -base64 32
const VERSION = 'v1'

function getKey(): Buffer {
    const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY
    if (!raw) throw new Error('INTEGRATIONS_ENCRYPTION_KEY is not defined')
    const key = Buffer.from(raw, 'base64')
    if (key.length !== 32) throw new Error('INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes')
    return key
}

export function encryptCredentials(credentials: Record<string, string>): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptCredentials(payload: string): Record<string, string> {
    const [version, iv, tag, ciphertext] = payload.split(':')
    if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Unrecognised credential payload')
    const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()])
    return JSON.parse(plaintext.toString('utf8'))
}

export function hintFor(secret: string): string {
    return secret.length <= 4 ? '••••' : secret.slice(-4)
}
