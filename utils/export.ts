export function exportToCSV(data: Record<string, any>[], filename: string) {
    if (!data || !data.length) return

    // 1. Get Headers
    const headers = Object.keys(data[0])

    // 2. Format CSV Content
    const csvContent = [
        headers.join(','), // Header Row
        ...data.map(row => headers.map(fieldName => {
            let value = row[fieldName]
            // Handle strings with commas or newlines
            if (typeof value === 'string') {
                value = `"${value.replace(/"/g, '""')}"`
            }
            return value
        }).join(','))
    ].join('\n')

    // 3. Create Blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

    // 4. Trigger Download
    const link = document.createElement('a')
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }
}
