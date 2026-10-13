// Catalog of the providers organizers can connect. Shared by the settings UI and server validation,
// so it must stay free of server-only imports.

export type IntegrationCategory = 'payments' | 'sms' | 'marketing'

export type CredentialField = {
    key: string
    label: string
    secret: boolean
    required: boolean
    placeholder?: string
    help?: string
}

export type ProviderDefinition = {
    id: string
    category: IntegrationCategory
    name: string
    description: string
    regions: string
    docsUrl: string
    supportsTestMode: boolean
    fields: CredentialField[]
    /** Payments only: ISO currencies this provider can charge in. Kept conservative; widen as needed. */
    currencies?: string[]
    /** Payments only: how buyers can pay, shown at checkout */
    methods?: string[]
    /** Payments only: checkout needs the buyer's phone number (e.g. M-Pesa STK push) */
    requiresPhone?: boolean
}

export const PROVIDERS: ProviderDefinition[] = [
    // Payments
    {
        id: 'stripe',
        currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ZAR'],
        methods: ['Card', 'Apple Pay', 'Google Pay'],
        category: 'payments',
        name: 'Stripe',
        description: 'Cards, Apple Pay and Google Pay in 40+ countries.',
        regions: 'Global',
        docsUrl: 'https://dashboard.stripe.com/apikeys',
        supportsTestMode: true,
        fields: [
            { key: 'publishable_key', label: 'Publishable key', secret: false, required: true, placeholder: 'pk_live_…' },
            { key: 'secret_key', label: 'Secret key', secret: true, required: true, placeholder: 'sk_live_…' },
            { key: 'webhook_secret', label: 'Webhook signing secret', secret: true, required: false, placeholder: 'whsec_…', help: 'Add after creating the webhook endpoint in Stripe.' },
        ],
    },
    {
        id: 'paystack',
        currencies: ['GHS', 'NGN', 'KES', 'ZAR', 'USD', 'XOF'],
        methods: ['Card', 'Mobile money', 'Bank transfer'],
        category: 'payments',
        name: 'Paystack',
        description: 'Cards, mobile money and bank transfers.',
        regions: 'Ghana, Nigeria, Kenya, South Africa',
        docsUrl: 'https://dashboard.paystack.com/#/settings/developers',
        supportsTestMode: true,
        fields: [
            { key: 'public_key', label: 'Public key', secret: false, required: true, placeholder: 'pk_live_…' },
            { key: 'secret_key', label: 'Secret key', secret: true, required: true, placeholder: 'sk_live_…' },
        ],
    },
    {
        id: 'flutterwave',
        currencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'ZAR', 'XAF', 'XOF', 'ZMW', 'USD', 'EUR', 'GBP'],
        methods: ['Card', 'Mobile money', 'Bank transfer', 'USSD'],
        category: 'payments',
        name: 'Flutterwave',
        description: 'Cards, mobile money, USSD and bank transfers.',
        regions: 'Pan-African',
        docsUrl: 'https://app.flutterwave.com/dashboard/settings/apis/live',
        supportsTestMode: true,
        fields: [
            { key: 'public_key', label: 'Public key', secret: false, required: true, placeholder: 'FLWPUBK-…' },
            { key: 'secret_key', label: 'Secret key', secret: true, required: true, placeholder: 'FLWSECK-…' },
            { key: 'webhook_hash', label: 'Webhook secret hash', secret: true, required: false, help: 'The secret hash you set under Settings → Webhooks.' },
        ],
    },
    {
        id: 'hubtel',
        currencies: ['GHS'],
        methods: ['Mobile money', 'Card'],
        category: 'payments',
        name: 'Hubtel',
        description: 'Mobile money and cards in Ghana.',
        regions: 'Ghana',
        docsUrl: 'https://developers.hubtel.com',
        supportsTestMode: false,
        fields: [
            { key: 'merchant_account_number', label: 'Merchant account number', secret: false, required: true },
            { key: 'client_id', label: 'API ID', secret: false, required: true },
            { key: 'client_secret', label: 'API key', secret: true, required: true },
        ],
    },
    {
        id: 'mpesa',
        currencies: ['KES'],
        methods: ['M-Pesa'],
        requiresPhone: true,
        category: 'payments',
        name: 'M-Pesa (Daraja)',
        description: 'Lipa na M-Pesa STK push.',
        regions: 'Kenya',
        docsUrl: 'https://developer.safaricom.co.ke',
        supportsTestMode: true,
        fields: [
            { key: 'shortcode', label: 'Business shortcode', secret: false, required: true, placeholder: '174379' },
            { key: 'consumer_key', label: 'Consumer key', secret: true, required: true },
            { key: 'consumer_secret', label: 'Consumer secret', secret: true, required: true },
            { key: 'passkey', label: 'Lipa na M-Pesa passkey', secret: true, required: true },
        ],
    },
    {
        id: 'wave',
        currencies: ['XOF', 'UGX', 'GMD'],
        methods: ['Wave'],
        category: 'payments',
        name: 'Wave',
        description: 'Mobile money checkout.',
        regions: 'Senegal, Côte d’Ivoire, Mali, Burkina Faso, Gambia, Uganda',
        docsUrl: 'https://docs.wave.com/checkout',
        supportsTestMode: false,
        fields: [
            { key: 'api_key', label: 'API key', secret: true, required: true, placeholder: 'wave_sn_prod_…' },
            { key: 'webhook_secret', label: 'Webhook secret', secret: true, required: false },
        ],
    },

    // SMS
    {
        id: 'twilio',
        category: 'sms',
        name: 'Twilio',
        description: 'Global SMS delivery.',
        regions: 'Global',
        docsUrl: 'https://console.twilio.com',
        supportsTestMode: false,
        fields: [
            { key: 'account_sid', label: 'Account SID', secret: false, required: true, placeholder: 'AC…' },
            { key: 'auth_token', label: 'Auth token', secret: true, required: true },
            { key: 'sender_id', label: 'From number or Messaging Service SID', secret: false, required: true, placeholder: '+1555… or MG…' },
        ],
    },
    {
        id: 'clicksend',
        category: 'sms',
        name: 'ClickSend',
        description: 'SMS in 200+ countries.',
        regions: 'Global',
        docsUrl: 'https://dashboard.clicksend.com/account/subaccounts',
        supportsTestMode: false,
        fields: [
            { key: 'username', label: 'Username', secret: false, required: true },
            { key: 'api_key', label: 'API key', secret: true, required: true },
            { key: 'sender_id', label: 'Sender ID', secret: false, required: false, placeholder: 'GATEPASS' },
        ],
    },
    {
        id: 'zend',
        category: 'sms',
        name: 'Zend',
        description: 'SMS for Ghana and West Africa.',
        regions: 'Ghana',
        docsUrl: 'https://tryzend.com',
        supportsTestMode: false,
        fields: [
            { key: 'api_key', label: 'API key', secret: true, required: true },
            { key: 'sender_id', label: 'Sender ID', secret: false, required: false, placeholder: 'GATEPASS' },
        ],
    },
    {
        id: 'hubtel',
        category: 'sms',
        name: 'Hubtel',
        description: 'SMS for Ghana.',
        regions: 'Ghana',
        docsUrl: 'https://developers.hubtel.com',
        supportsTestMode: false,
        fields: [
            { key: 'client_id', label: 'Client ID', secret: false, required: true },
            { key: 'client_secret', label: 'Client secret', secret: true, required: true },
            { key: 'sender_id', label: 'Sender ID', secret: false, required: false, placeholder: 'GATEPASS' },
        ],
    },

    // Marketing
    {
        id: 'meta',
        category: 'marketing',
        name: 'Meta Pixel',
        description: 'Track ticket sales from Facebook and Instagram ads.',
        regions: 'Global',
        docsUrl: 'https://business.facebook.com/events_manager',
        supportsTestMode: false,
        fields: [
            { key: 'pixel_id', label: 'Pixel ID', secret: false, required: true, placeholder: '1234567890' },
            { key: 'capi_access_token', label: 'Conversions API token', secret: true, required: false, help: 'Optional. Sends purchases server-side for more accurate tracking.' },
        ],
    },
    {
        id: 'ga4',
        category: 'marketing',
        name: 'Google Analytics 4',
        description: 'Measure traffic and conversions on event pages.',
        regions: 'Global',
        docsUrl: 'https://analytics.google.com',
        supportsTestMode: false,
        fields: [
            { key: 'measurement_id', label: 'Measurement ID', secret: false, required: true, placeholder: 'G-XXXXXXXXXX' },
            { key: 'api_secret', label: 'Measurement Protocol API secret', secret: true, required: false, help: 'Optional. Sends purchases server-side.' },
        ],
    },
]

export function getProvider(category: IntegrationCategory, id: string): ProviderDefinition | undefined {
    return PROVIDERS.find(p => p.category === category && p.id === id)
}

export function providersFor(category: IntegrationCategory): ProviderDefinition[] {
    return PROVIDERS.filter(p => p.category === category)
}

/** Currency names for pickers. */
export const CURRENCY_NAMES: Record<string, string> = {
    GHS: 'Ghanaian cedi', NGN: 'Nigerian naira', KES: 'Kenyan shilling', ZAR: 'South African rand', UGX: 'Ugandan shilling',
    TZS: 'Tanzanian shilling', RWF: 'Rwandan franc', XOF: 'West African CFA franc', XAF: 'Central African CFA franc',
    ZMW: 'Zambian kwacha', GMD: 'Gambian dalasi', USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', CAD: 'Canadian dollar', AUD: 'Australian dollar',
}

/** Whether a payment provider can charge in this currency. Unknown providers are allowed through. */
export function providerSupportsCurrency(providerId: string, currency: string): boolean {
    const provider = getProvider('payments', providerId)
    return !provider?.currencies || provider.currencies.includes(currency.toUpperCase())
}
