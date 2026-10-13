# GatePass — Complete Features & Functionality

> **GatePass** is a full-stack event ticketing and management platform built with Next.js, Supabase, and Paystack. It targets event organizers and attendees with a premium, mobile-first experience.

---

## 1. Public-Facing / Attendee Experience

### Event Discovery
- **Featured Event Feed** — Full-screen, swipeable event feed on the landing page showcasing featured events
- **Event Detail Pages** — Rich event pages at `/events/[slug]` with poster/video media, venue info, social links, lineup, and ticketing
- **SEO & Open Graph** — Dynamic OG images, meta descriptions, sitemap generation, and robots.txt for discoverability
- **Short Links** — Shareable short URLs via `/i/[code]` for marketing campaigns

### Ticket Purchasing
- **Multi-Tier Tickets** — Multiple ticket types per event (e.g. VIP, Regular, Early Bird) with individual pricing, descriptions, perks, quantity limits, and visibility controls
- **Quantity Discounts** — Automatic discounts when purchasing in bulk (percentage or fixed) configured per ticket tier
- **Min Quantity Enforcement** — Minimum purchase quantity per ticket tier
- **Promo Codes / Discounts** — Coupon codes with percentage or fixed discounts, per-event or per-tier targeting, usage limits, and expiry dates
- **Event Add-ons** — Purchasable extras (e.g. merch, food, parking) with quantity or toggle selection, images, and optional tier linking
- **Guest Checkout** — Purchase tickets without creating an account (name, email, phone)
- **Authenticated Checkout** — Logged-in users can purchase and manage tickets under their account
- **Reservation System** — Tickets are reserved with expiry timers before payment to prevent overselling
- **Custom Forms** — Organizers can add custom questions (text, select, checkbox) that attendees fill out before purchase

### Payment Processing
- **Paystack Integration** — Full payment processing via Paystack (inline checkout)
- **Webhook Verification** — Server-side payment verification via Paystack webhooks for reliability
- **Fee Calculation Engine** — Configurable platform fees, processor fees, and fee bearer logic (customer-pays or organizer-absorbs)
- **Multi-Currency Support** — Events can be configured with different currencies (GHS, USD, etc.)

### Instalment Payments (Buy Now, Pay Later)
- **Payment Plans** — Organizers can offer instalment plans per ticket tier (e.g. pay 50% now, rest in 2 instalments)
- **Instalment Reservations** — Separate tracking of instalment payment schedules per customer
- **Instalment Payment Portal** — Dedicated customer-facing instalment management page at `/my-tickets/instalments/[id]`
- **Automated Reminders** — Cron-driven email/SMS reminders for upcoming instalment due dates
- **Grace Periods** — Configurable grace period hours before forfeiture
- **Early Completion** — Option to allow customers to pay remaining balance early
- **Forfeit on Miss** — Auto-forfeit instalment reservations when payments are missed (configurable)

### Virtual Tickets
- **Virtual Event Support** — Ticket tiers can be marked as virtual with a link and instructions
- **Virtual Link Email** — Automated email delivery of virtual event links to attendees

### Ticket Management (Attendee)
- **My Tickets** — Attendee portal at `/my-tickets` showing all purchased tickets
- **QR Code Tickets** — Each ticket has a unique QR code hash for entry scanning
- **Ticket PDF Download** — Generate and download ticket PDFs via `/api/tickets/[id]/download`
- **Receipt Download** — Generate and download purchase receipts via `/api/reservations/[id]/receipt`
- **Apple Wallet Pass** — Generate `.pkpass` files for adding tickets to Apple Wallet via `/api/wallet/apple`
- **Ticket Transfers** — Transfer tickets to other users via email with claim tokens at `/claim/[token]`

### Waitlist
- **Tier-Level Waitlist** — When a specific ticket tier sells out, customers can join a waitlist for that tier
- **General Waitlist** — Event-level waitlist when all ticket sales are paused

### Embeddable Widget
- **Embed Widget** — Full-featured ticket purchasing widget at `/embed/[slug]` that can be embedded on external websites via iframe
- **Theme Support** — Widget supports dark/light themes via URL parameters
- **Custom Branding** — Configurable primary color, font, and logo per event
- **Animated Views** — Smooth animated transitions between detail, ticket selection, add-ons, checkout, summary, and success views

---

## 2. Organizer Dashboard

### Dashboard Overview
- **Revenue Summary** — Total revenue, ticket sales, and event counts at a glance
- **Recent Transactions** — Quick view of latest sales with customer details
- **Organization Switching** — Switch between multiple organizations via cookie-based context (`switch-org` action)

### Event Management
- **Create Events** — Rich event creation form with title, slug, description, venue, dates, poster/video upload, social links, branding, and fee configuration
- **Edit Events** — Full event editing in the management interface
- **Duplicate Events** — Clone existing events (including tiers, settings, and add-ons) for quick re-creation
- **Delete Events** — Safe deletion with all dependency cleanup (tickets, reservations, staff, add-ons, discounts, tiers)
- **Publish/Unpublish Toggle** — Control event visibility with a publish switch
- **Scheduled Publishing** — Set a future date/time for automatic event publication
- **Ticket Sales Toggle** — Enable/disable ticket sales while keeping the event live (hides "Get Tickets" button)
- **Event Lineup** — Add performer/speaker lineup with name, role, image, and time
- **Event Branding** — Customizable primary color, logo, and poster/video media
- **Social Links** — Website, Instagram, Twitter, Facebook links per event
- **Video Transcoding** — Client-side FFmpeg-based video transcoding for event media

### Ticket Tier Management
- **Create/Edit/Delete Tiers** — Full CRUD on ticket tiers with price, quantity, description, perks, tags, visibility, and sort order
- **Tier Visibility** — Show/hide individual tiers from the public checkout
- **Tier Sort Order** — Control display ordering of ticket tiers
- **Tier Tags** — Categorize tiers with custom tags
- **Virtual Tier Configuration** — Set tiers as virtual with link and instructions

### Add-ons Management
- **Create/Edit/Delete Add-ons** — Full CRUD on event add-ons (merch, extras, etc.)
- **Add-on Linking** — Optionally tie add-ons to specific ticket tiers
- **Quantity vs Toggle** — Configure add-ons as quantity-selectable or binary toggle

### Discount/Promo Code Management
- **Create/Edit/Delete Discounts** — Manage promo codes with type (percentage/fixed), value, max uses, expiry, and tier targeting
- **Affiliate Discounts** — Link discount codes to affiliates with commission percentages and sale notification emails
- **UTM Campaign Linking** — Associate discount codes with UTM campaigns for marketing attribution

### Payment Plan Management
- **Create/Edit Payment Plans** — Configure instalment plans with initial percentage, number of instalments, deadline days, and policies
- **Instalment Monitoring** — View and manage active instalment reservations, payments, and statuses

### Staff & Access Management
- **Event Staff** — Add door staff with name, email, and access codes
- **Staff Access Emails** — Automated email with access credentials sent to event staff
- **Check-in Tracking** — Records who checked in each ticket and when

### Attendee Management
- **Attendees List** — View all ticket holders per event with search and filtering
- **Guest Import** — Bulk import guest lists via CSV/file upload
- **Customer CRM** — Cross-event customer directory at `/dashboard/customers` with purchase history
- **Custom Form Responses** — View attendee responses to custom event forms
- **Export Data** — Export attendee and sales data

### Sales & Revenue
- **All Sales View** — Consolidated sales dashboard at `/dashboard/sales` with transaction details
- **Transaction Details** — Detailed modal view of individual transactions with fee breakdown
- **Revenue Breakdown** — Per-event revenue with platform and processor fee calculations

### Payouts
- **Request Payouts** — Organizers can request payouts for event revenue
- **Payout Status Tracking** — Track payout requests through pending → processing → paid states
- **Discord Notifications** — Automated Discord webhook alerts when payout requests are submitted

### Marketing & Analytics
- **Marketing Dashboard** — Campaign tracking, UTM attribution, and conversion analytics at `/dashboard/marketing`
- **Marketing Funnel** — Track visitor → reservation → purchase conversion rates
- **UTM Tracking** — Capture and attribute sales to UTM campaign parameters
- **Tracking Scripts** — Support for Google Analytics / Pixel tracking scripts per event
- **View Count Analytics** — Track event page views with RPC-based increment

### Live Monitoring

### Activity Logging
- **Activity Feed** — Chronological log of all organization actions (event updates, sales, check-ins, etc.)
- **Audit Trail** — Persistent activity logs for compliance and debugging

### Settings
- **Profile Settings** — Update personal profile, avatar, username
- **Organization Settings** — Manage organization name, slug, logo, description, social links
- **Settlement Settings** — Configure bank account details for payouts (bank name, account number, Paystack recipient setup)
- **Team Management** — Invite team members by email with role assignment (admin/staff), manage and remove members
- **Notification Settings** — Configure email notification preferences
- **SMS Provider Settings** — Configure SMS providers (Hubtel or TryZend) with API credentials and sender ID
- **Marketing Settings** — Configure tracking pixel IDs and UTM defaults

---

## 3. Communications & Notifications

### Email
- **Ticket Confirmation Email** — Branded HTML email with ticket details, QR codes, and event info (via Resend + React Email)
- **Virtual Link Email** — Separate email delivery of virtual event access links
- **Transfer Email** — Email notification when a ticket is transferred to someone
- **Staff Access Email** — Email with scanning credentials sent to event staff
- **Payout Email** — Email confirmation when payout is processed
- **Instalment Reminder Emails** — Automated emails reminding customers of upcoming instalment payments

### SMS
- **Bulk SMS to Attendees** — Send SMS to all event attendees via configured provider
- **SMS Provider Support** — Hubtel and TryZend SMS gateway integrations
- **Instalment SMS Reminders** — Automated SMS reminders for instalment due dates

### Webhooks & Integrations
- **Discord Notifications** — Automated Discord webhook alerts for sales and payout requests
- **Slack Notifications** — Optional Slack webhook integration for sale alerts
- **Admin Email Alerts** — Email notifications to admin on new sales

---

## 4. Super Admin Panel

### Platform Management (at `/admin`)
- **Platform Dashboard** — Overview of all platform metrics, revenue, and active events
- **Platform Pulse** — Real-time system health and activity indicators

### User Management
- **User Directory** — Searchable table of all platform users at `/admin/users`
- **User Detail View** — Detailed user profile at `/admin/users/[id]` showing organizations, events, and activity
- **Suspend/Unsuspend Users** — Ban users from the platform
- **Toggle Super Admin** — Grant or revoke super admin privileges
- **Delete Users** — Full user deletion with cascading cleanup of all related data (organizations, events, tickets, reservations, team memberships, auth)
- **Delete Organizations** — Full organization deletion with cascading event and data cleanup

### Financial Management
- **Finance Dashboard** — Platform-wide revenue, fees, and transaction analytics at `/admin/financials`
- **Global Transaction Table** — View all transactions across the platform
- **Payout Management** — Approve, reject, or process payout requests at `/admin/payouts` with Paystack transfer integration (auto-create recipients and initiate transfers)

### Event Oversight
- **Master Events Table** — View and manage all events across all organizers at `/admin/events`
- **Event Detail Management** — Full event editing and configuration at `/admin/events/[id]`

### Platform Settings
- **System Settings** — Configure global platform fee percentages and system-wide defaults at `/admin/settings`
- **Reports** — Platform-wide reporting tools at `/admin/reports`

### Activity Monitoring
- **Global Activity Feed** — Platform-wide activity log at `/admin/activity`
- **Analytics Charts** — Visual analytics with charts for platform-level metrics

---

## 5. Infrastructure & Technical

### Authentication
- **Supabase Auth** — Email-based authentication with OAuth callback support
- **Row-Level Security (RLS)** — Database-level access controls for multi-tenant data isolation
- **Middleware/Proxy** — Route protection and auth enforcement

### Database
- **Supabase (PostgreSQL)** — Primary data store with `gatepass` schema
- **83 Migrations** — Comprehensive migration history covering all schema evolution
- **RPC Functions** — Server-side PostgreSQL functions for atomic operations (discount application, view count increment, inventory management)
- **Performance Indexes** — Optimized database indexes for common query patterns

### API Layer
- **Server Actions** — Next.js server actions for secure, typed backend operations
- **API Routes** — RESTful API routes for payment processing, ticket downloads, and external integrations
- **Cron Jobs** — Scheduled tasks for event reminders and instalment payment reminders

### Media & Storage
- **Supabase Storage** — File storage for event posters, videos, logos, and profile avatars
- **Media Uploader** — Drag-and-drop media upload component with preview
- **Video Transcoding** — Client-side FFmpeg transcoding for video optimization

### SEO & Performance
- **Dynamic Sitemap** — Auto-generated sitemap from published events
- **Robots.txt** — SEO-friendly robots configuration
- **OG Image Generation** — Dynamic Open Graph images per event
- **Static Page Generation** — Pre-rendered static pages where applicable
- **Edge Runtime** — Edge-optimized routes for performance

### PDF Generation
- **Ticket PDFs** — Server-side ticket PDF generation with QR codes
- **Receipt PDFs** — Server-side receipt PDF generation with transaction details

### Form Validation
- **Zod Schemas** — Type-safe validation for events, ticket tiers, discounts, staff, and add-ons

### Legal
- **Privacy Policy** — Static privacy policy page
- **Terms of Service** — Static terms of service page

---

## Summary Statistics

| Category | Count |
|---|---|
| Dashboard Pages | 12 |
| Admin Pages | 8 |
| API Routes | 16 |
| Database Migrations | 83 |
| Email Templates | 5 |
| SMS Providers | 2 |
| Component Files | ~60+ |
