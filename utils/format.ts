export const formatCurrency = (amount: number, currency: string = 'GHS') => {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)
}

export const formatCompactNumber = (number: number) => {
    return new Intl.NumberFormat('en-GH', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(number || 0)
}

export const formatCompactCurrency = (amount: number, currency: string = 'GHS') => {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: currency,
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(amount || 0)
}

export const formatDateTime = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(dateStr))
}
