
import { calculateFees, getEffectiveFeeRates } from '../utils/fees';

const runTest = (name: string, fn: () => void) => {
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
    } catch (e: any) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(e.message);
        process.exit(1); // Fail fast
    }
};

const assertClose = (actual: number, expected: number, precision = 0.001, message?: string) => {
    if (Math.abs(actual - expected) > precision) {
        throw new Error(`${message || 'Assertion failed'}: Expected ${expected}, got ${actual}`);
    }
};

console.log("Starting Accounting & Fee Tests...\n");

// --- Test Case 1: Standard Customer Pays (Defaults) ---
runTest('Standard Transaction: Customer Pays Fees (Default Rates)', () => {
    // defaults: Platform 4%, Processor 1.98%
    const subtotal = 100;
    const result = calculateFees(subtotal, 0, 'customer');

    // Platform: 100 * 0.04 = 4
    // Processor: 100 * 0.0198 = 1.98
    // Client Fees: 4 + 1.98 = 5.98
    // Customer Total: 105.98
    // Organizer Payout: 100 (since customer paid fees)

    assertClose(result.platformFee, 4.00, 0.001, 'Platform Fee');
    assertClose(result.processorFee, 1.98, 0.001, 'Processor Fee');
    assertClose(result.clientFees, 5.98, 0.001, 'Client Fees');
    assertClose(result.customerTotal, 105.98, 0.001, 'Customer Total');
    assertClose(result.organizerPayout, 100.00, 0.001, 'Organizer Payout');
});

// --- Test Case 2: Organizer Pays Fees ---
runTest('Standard Transaction: Organizer Pays Fees', () => {
    const subtotal = 100;
    // Note: In current logic, Platform Fee is ALWAYS added to client fees (customer pays), 
    // unless logic is changed. Let's verify CURRENT implementation.
    // If feeBearer is 'organizer', ONLY processor fee is switched to organizer deduction?
    // Let's check the code behavior: 
    // clientFees = platformFee + (feeBearer === 'customer' ? processorFee : 0)
    // So Customer ALWAYS pays Platform Fee (4.00).

    const result = calculateFees(subtotal, 0, 'organizer');

    // Platform: 4.00
    // Processor: 1.98
    // Client Fees: 4.00 + 0 = 4.00 (Customer pays Platform only)
    // Customer Total: 104.00
    // Organizer Payout: 100 - 1.98 = 98.02

    assertClose(result.platformFee, 4.00, 0.001, 'Platform Fee');
    assertClose(result.processorFee, 1.98, 0.001, 'Processor Fee');

    // VERIFYING CURRENT BEHAVIOR (Behavior might be debateable, but testing implementation)
    assertClose(result.clientFees, 4.00, 0.001, 'Client Fees (Platform only)');
    assertClose(result.customerTotal, 104.00, 0.001, 'Customer Total');
    assertClose(result.organizerPayout, 98.02, 0.001, 'Organizer Payout (Less Processor Fee)');
});

// --- Test Case 3: Event Specific Override ---
runTest('Event Override: Higher Platform Fee', () => {
    const globalRates = { platformFeePercent: 0.04, processorFeePercent: 0.0198 };
    const eventOverride = { platform_fee_percent: 0.10 }; // 10%

    const effectiveRates = getEffectiveFeeRates(globalRates, eventOverride, undefined);

    assertClose(effectiveRates.platformFeePercent, 0.10, 0.0001, 'Effective Platform Rate');

    const result = calculateFees(100, 0, 'customer', effectiveRates);

    // Platform: 100 * 0.10 = 10
    // Processor: 100 * 0.0198 = 1.98
    // Client Fees: 11.98

    assertClose(result.platformFee, 10.00, 0.001, 'Platform Fee');
    assertClose(result.clientFees, 11.98, 0.001, 'Client Fees');
});

// --- Test Case 4: Global Processor Fee Change ---
runTest('Global Settings: Custom Processor Fee', () => {
    const globalRates = { platformFeePercent: 0.04, processorFeePercent: 0.05 }; // 5% Processor

    const result = calculateFees(100, 0, 'customer', globalRates);

    // Platform: 4
    // Processor: 5

    assertClose(result.processorFee, 5.00, 0.001, 'Processor Fee');
    assertClose(result.clientFees, 9.00, 0.001, 'Client Fees');
});

// --- Test Case 5: With Add-ons ---
runTest('Transaction with Add-ons (Customer Pays)', () => {
    const ticketSubtotal = 100;
    const addonSubtotal = 50;
    // Total Revenue Base = 150
    // Platform Fee only applies to Ticket Subtotal (100) -> 4.00
    // Processor Fee applies to Combined Subtotal (150) -> 150 * 0.0198 = 2.97

    const result = calculateFees(ticketSubtotal, addonSubtotal, 'customer');

    assertClose(result.subtotal, 150.00, 0.001, 'Combined Subtotal');
    assertClose(result.platformFee, 4.00, 0.001, 'Platform Fee (Tickets Only)');
    assertClose(result.processorFee, 2.97, 0.001, 'Processor Fee (Total)');
    assertClose(result.clientFees, 6.97, 0.001, 'Client Fees');
    assertClose(result.customerTotal, 156.97, 0.001, 'Customer Total');
});

// --- Test Case 6: Tiny Amounts (Rounding check) ---
runTest('Small Amount Precision', () => {
    const subtotal = 10;
    const result = calculateFees(subtotal, 0, 'customer');

    // P: 0.4
    // Pr: 0.198
    // Tot: 10.598

    assertClose(result.platformFee, 0.4, 0.0001);
    assertClose(result.processorFee, 0.198, 0.0001);
});

console.log("\nAll tests passed successfully! 🚀");
