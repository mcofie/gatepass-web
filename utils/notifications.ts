import { Resend } from 'resend'

export const notifyAdminOfSale = async (data: {
    eventName: string,
    customerName: string,
    amount: number,
    currency: string,
    quantity: number,
    ticketType: string
}) => {
    const slackWebhookUrl = process.env.ADMIN_SLACK_WEBHOOK_URL
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
    const adminEmail = process.env.ADMIN_EMAIL
    const resendApiKey = process.env.RESEND_API_KEY

    // 1. Notify via Slack
    if (slackWebhookUrl) {
        try {
            await fetch(slackWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚀 *New Sale on GatePass!*\n*Event:* ${data.eventName}\n*Customer:* ${data.customerName}\n*Ticket:* ${data.quantity}x ${data.ticketType}\n*Total:* ${data.currency} ${data.amount.toFixed(2)}`
                })
            })
            console.log('Admin Slack notification sent.')
        } catch (err) {
            console.error('Failed to send Slack notification:', err)
        }
    }

    // 2. Notify via Discord
    if (discordWebhookUrl) {
        try {
            await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "🚀 New Sale on GatePass!",
                        color: 0x000000, // Black to match GatePass branding
                        fields: [
                            { name: "Event", value: data.eventName, inline: true },
                            { name: "Customer", value: data.customerName, inline: true },
                            { name: "Tickets", value: `${data.quantity}x ${data.ticketType}`, inline: false },
                            { name: "Total Amount", value: `${data.currency} ${data.amount.toFixed(2)}`, inline: true }
                        ],
                        footer: { text: "GatePass Notifications" },
                        timestamp: new Date().toISOString()
                    }]
                })
            })
            console.log('Admin Discord notification sent.')
        } catch (err) {
            console.error('Failed to send Discord notification:', err)
        }
    }

    // 3. Notify via Email
    if (adminEmail && resendApiKey) {
        try {
            const resend = new Resend(resendApiKey)
            await resend.emails.send({
                from: 'GatePass Sales <sales@updates.gatepass.so>',
                to: adminEmail,
                subject: `New Sale: ${data.eventName}`,
                html: `
                    <h1>New Sale Alert!</h1>
                    <p><strong>Event:</strong> ${data.eventName}</p>
                    <p><strong>Customer:</strong> ${data.customerName}</p>
                    <p><strong>Tickets:</strong> ${data.quantity}x ${data.ticketType}</p>
                    <p><strong>Total Amount:</strong> ${data.currency} ${data.amount.toFixed(2)}</p>
                    <hr />
                    <p>Login to the admin dashboard to view details.</p>
                `
            })
            console.log('Admin email notification sent.')
        } catch (err) {
            console.error('Failed to send admin email notification:', err)
        }
    }
}
