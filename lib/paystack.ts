export const verifyPaystackTransaction = async (reference: string) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY

    if (!secretKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not defined')
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
        }
    })

    if (!response.ok) {
        throw new Error('Failed to verify transaction')
    }

    const data = await response.json()
    return data.data
}
