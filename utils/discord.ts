export async function notifyDiscord(message: string, type: 'info' | 'success' | 'warning' = 'info') {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
        console.warn('DISCORD_WEBHOOK_URL is missing. Skipping notification.')
        return
    }

    const color = type === 'success' ? 0x00FF00 : type === 'warning' ? 0xFFAA00 : 0x00AAFF

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: type === 'info' ? 'ℹ️ Info' : type === 'success' ? '✅ Success' : '⚠️ Warning',
                    description: message,
                    color: color,
                    timestamp: new Date().toISOString()
                }]
            })
        })
    } catch (error) {
        console.error('Failed to send Discord notification:', error)
    }
}
