export const PLATFORM_FEE_PERCENT = 0.04
export const PROCESSOR_FEE_PERCENT = 0.0195

/**
 * Resolves the effective fee rates for a specific event, prioritizing event-specific overrides
 * over global settings, and falling back to system defaults.
 */
export const getEffectiveFeeRates = (
    globalRates?: FeeRates,
    eventOverride?: { platform_fee_percent?: number | null },
    organizerOverride?: { platform_fee_percent?: number | null }
): FeeRates => {
    // 1. Determine Platform Fee
    // Precedence: Event Override > Organizer Override > Global Setting > Default
    let platformRate = PLATFORM_FEE_PERCENT

    if (eventOverride?.platform_fee_percent && eventOverride.platform_fee_percent > 0) {
        platformRate = eventOverride.platform_fee_percent
    } else if (organizerOverride?.platform_fee_percent && organizerOverride.platform_fee_percent > 0) {
        platformRate = organizerOverride.platform_fee_percent
    } else if (globalRates?.platformFeePercent) {
        platformRate = globalRates.platformFeePercent
    }

    // 2. Determine Processor Fee
    // Currently only global or default (no event-specific override supported yet)
    let processorRate = globalRates?.processorFeePercent ?? PROCESSOR_FEE_PERCENT

    return {
        platformFeePercent: platformRate,
        processorFeePercent: processorRate
    }
}

interface FeeResult {
    subtotal: number
    platformFee: number // 4%, always absorbed in ticket price (customer perspective) or deducted (organizer perspective)
    processorFee: number // 1.95%, added to total if customer bears, or deducted from payout if organizer bears
    clientFees: number // Total fees paid by customer
    customerTotal: number // What the customer pays
    organizerPayout: number // What the organizer gets (Net)
}

export interface FeeRates {
    platformFeePercent: number
    processorFeePercent: number
}

export const calculateFees = (
    subtotal: number,
    feeBearer: 'customer' | 'organizer' = 'customer',
    rates?: FeeRates
): FeeResult => {
    // defaults
    const platformRate = rates?.platformFeePercent ?? PLATFORM_FEE_PERCENT
    const processorRate = rates?.processorFeePercent ?? PROCESSOR_FEE_PERCENT

    // 1. Platform Fee
    const platformFee = subtotal * platformRate

    // 2. Processor Fee
    // If 'customer' bears fees -> Added to customer total.
    // If 'organizer' bears fees -> Deducted from organizer payout.
    const processorFee = subtotal * processorRate

    // clientFees = What the customer sees added to the Ticket Price
    // Always includes Platform Fee. Includes Processor Fee only if Customer bears it.
    const clientFees = platformFee + (feeBearer === 'customer' ? processorFee : 0)

    // customerTotal = Ticket + Client Fees
    const customerTotal = subtotal + clientFees

    // organizerPayout = Ticket - Deductions
    // If Organizer bears fees, Processor Fee is deducted. Platform Fee is never deducted (customer paid it).
    const organizerPayout = subtotal - (feeBearer === 'organizer' ? processorFee : 0)

    return {
        subtotal,
        platformFee,
        processorFee,
        clientFees,
        customerTotal,
        organizerPayout
    }
}
