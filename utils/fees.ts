export const PLATFORM_FEE_PERCENT = 0.04
export const PROCESSOR_FEE_PERCENT = 0.0195

interface FeeResult {
    subtotal: number
    platformFee: number // 4%, always absorbed in ticket price (customer perspective) or deducted (organizer perspective)
    processorFee: number // 1.95%, added to total if customer bears, or deducted from payout if organizer bears
    clientFees: number // Total fees paid by customer
    customerTotal: number // What the customer pays
    organizerPayout: number // What the organizer gets (Net)
}

export const calculateFees = (subtotal: number, feeBearer: 'customer' | 'organizer' = 'customer'): FeeResult => {
    const platformFee = subtotal * PLATFORM_FEE_PERCENT

    // Processor fee is typically calculated on the transaction amount.
    // For simplicity and standard usage, we Calculate it on the Subtotal here unless specified otherwise.
    // If strict reverse-calc is needed for "Organizer receives exactly X", that's different.
    // Assuming straightforward multiplication based on prompt context.
    const processorFee = subtotal * PROCESSOR_FEE_PERCENT

    // Updated Interpretation: Platform Fee is added to the fee (Customer pays on top).
    // Processor Fee is added if Customer bears it.

    // Customer Pays:
    // 1. Ticket Price (Subtotal)
    // 2. Platform Fee (4%)
    // 3. Processor Fee (1.95%) [If applicable]

    const clientFees = platformFee + (feeBearer === 'customer' ? processorFee : 0)
    const customerTotal = subtotal + clientFees

    // Payout Logic:
    // If Customer pays Platform Fee, Organizer keeps Ticket Price.
    // If Organizer bears Processor Fee, it comes out of Ticket Price.
    const organizerPayout = subtotal - (feeBearer === 'organizer' ? processorFee : 0)

    return {
        subtotal,
        platformFee,
        processorFee,
        clientFees, // Total fees visible to/paid by customer
        customerTotal,
        organizerPayout
    }
}
