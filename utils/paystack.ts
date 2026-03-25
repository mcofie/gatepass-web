export async function createTransferRecipient(name: string, account_number: string, bank_code: string, currency: string = 'GHS') {
    const res = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: currency === 'GHS' ? 'ghipss' : 'nuban',
            name: name,
            account_number: account_number,
            bank_code: bank_code,
            currency: currency,
        }),
    })

    const data = await res.json()
    if (!data.status) {
        throw new Error(data.message || 'Failed to create transfer recipient')
    }

    return data.data.recipient_code
}

export async function initiateTransfer(amount: number, recipient_code: string, reason: string, reference: string) {
    const res = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            source: 'balance',
            amount: Math.round(amount * 100), // convert to pesewas/kobo
            recipient: recipient_code,
            reason: reason,
            reference: reference, // Pass our own reference
        }),
    })

    const data = await res.json()
    if (!data.status) {
        throw new Error(data.message || 'Failed to initiate transfer')
    }

    return data.data
}

export async function listBanks(currency: string = 'GHS') {
    const res = await fetch(`https://api.paystack.co/bank?currency=${currency}`, {
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
    })
    const data = await res.json()
    return data.data || []
}
