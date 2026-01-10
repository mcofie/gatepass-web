import { z } from 'zod'

// ====================
// Event Validation
// ====================

export const eventSchema = z.object({
    title: z.string()
        .min(3, 'Title must be at least 3 characters')
        .max(100, 'Title must be under 100 characters'),
    slug: z.string()
        .min(3, 'URL slug must be at least 3 characters')
        .max(50, 'URL slug must be under 50 characters')
        .regex(/^[a-z0-9-]+$/, 'URL slug can only contain lowercase letters, numbers, and hyphens'),
    description: z.string().optional(),
    venue_name: z.string()
        .min(1, 'Venue name is required'),
    venue_address: z.string()
        .min(1, 'Venue address is required'),
    starts_at: z.string()
        .min(1, 'Start date/time is required'),
    ends_at: z.string().optional(),
    poster_url: z.string().url('Invalid poster URL').optional().or(z.literal('')),
    video_url: z.string().url('Invalid video URL').optional().or(z.literal('')),
    logo_url: z.string().url('Invalid logo URL').optional().or(z.literal('')),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional().or(z.literal('')),
})

export type EventFormData = z.infer<typeof eventSchema>

// ====================
// Ticket Tier Validation
// ====================

export const ticketTierSchema = z.object({
    name: z.string()
        .min(1, 'Ticket name is required')
        .max(50, 'Ticket name must be under 50 characters'),
    price: z.number()
        .min(0, 'Price cannot be negative'),
    total_quantity: z.number()
        .min(1, 'Quantity must be at least 1')
        .max(100000, 'Quantity cannot exceed 100,000'),
    max_per_order: z.number()
        .min(1, 'Max per order must be at least 1')
        .max(100, 'Max per order cannot exceed 100')
        .optional(),
    description: z.string()
        .max(500, 'Description must be under 500 characters')
        .optional(),
    perks: z.array(z.string()).optional(),
})

export type TicketTierFormData = z.infer<typeof ticketTierSchema>

// ====================
// Discount Validation
// ====================

export const discountSchema = z.object({
    code: z.string()
        .min(1, 'Discount code is required')
        .max(20, 'Code must be under 20 characters')
        .regex(/^[A-Z0-9-]+$/i, 'Code can only contain letters, numbers, and hyphens'),
    type: z.enum(['percentage', 'fixed'], {
        message: 'Select a discount type'
    }),
    value: z.number()
        .positive('Value must be greater than 0'),
    max_uses: z.number()
        .min(0, 'Max uses cannot be negative')
        .optional(),
    expires_at: z.string().optional(),
    tier_id: z.string().optional(),
}).refine(
    (data) => {
        if (data.type === 'percentage' && data.value > 100) {
            return false
        }
        return true
    },
    { message: 'Percentage discount cannot exceed 100%', path: ['value'] }
)

export type DiscountFormData = z.infer<typeof discountSchema>

// ====================
// Guest/Checkout Validation
// ====================

export const guestCheckoutSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be under 100 characters'),
    email: z.string()
        .email('Please enter a valid email address'),
    phone: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .optional()
        .or(z.literal('')),
})

export type GuestCheckoutFormData = z.infer<typeof guestCheckoutSchema>

// ====================
// Staff Validation
// ====================

export const staffSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be under 100 characters'),
    email: z.string()
        .email('Please enter a valid email address'),
    role: z.enum(['Admin', 'Staff'], {
        message: 'Select a role'
    }),
})

export type StaffFormData = z.infer<typeof staffSchema>

// ====================
// Waitlist Validation (for Phase 3)
// ====================

export const waitlistSchema = z.object({
    email: z.string()
        .email('Please enter a valid email address'),
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be under 100 characters'),
})

export type WaitlistFormData = z.infer<typeof waitlistSchema>

// ====================
// Validation Helpers
// ====================

/**
 * Validate form data against a schema and return errors
 */
export function validateForm<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data)

    if (result.success) {
        return { success: true, data: result.data }
    }

    const errors: Record<string, string> = {}
    result.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        if (!errors[path]) {
            errors[path] = issue.message
        }
    })

    return { success: false, errors }
}

/**
 * Get a single field error from validation result
 */
export function getFieldError(
    errors: Record<string, string> | undefined,
    field: string
): string | undefined {
    return errors?.[field]
}

/**
 * Check if a field has an error
 */
export function hasFieldError(
    errors: Record<string, string> | undefined,
    field: string
): boolean {
    return !!errors?.[field]
}
