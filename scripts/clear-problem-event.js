/* eslint-disable */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const EVENT_ID = '54a1b7a8-c6e0-448d-974f-253cd556fdf4'

async function clearEventData() {
    console.log(`⚠️  Starting cleanup for Event: ${EVENT_ID}...`)

    // 1. Get Reservation IDs to link Transactions
    const { data: reservations, error: fetchErr } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('id')
        .eq('event_id', EVENT_ID)

    if (fetchErr) {
        console.error('Error fetching reservations:', fetchErr)
        return
    }

    const reservationIds = reservations.map(r => r.id)
    console.log(`Found ${reservationIds.length} reservations to clear.`)

    if (reservationIds.length > 0) {
        // 2. Delete Transactions
        const { error: txError } = await supabase
            .schema('gatepass')
            .from('transactions')
            .delete()
            .in('reservation_id', reservationIds)

        if (txError) console.error('Error deleting transactions:', txError)
        else console.log('✅ Transactions cleared')
    }

    // 3. Delete Tickets (Assuming linked by event_id or reservation_id)
    // Tickets likely have event_id directly
    const { error: ticketError } = await supabase
        .schema('gatepass')
        .from('tickets')
        .delete()
        .eq('event_id', EVENT_ID)

    if (ticketError) console.error('Error deleting tickets:', ticketError)
    else console.log('✅ Tickets cleared')

    // 4. Delete Payouts
    const { error: payoutError } = await supabase
        .schema('gatepass')
        .from('payouts')
        .delete()
        .eq('event_id', EVENT_ID)

    if (payoutError) console.error('Error deleting payouts:', payoutError)
    else console.log('✅ Payouts cleared')

    // 5. Delete Reservations
    const { error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .delete()
        .eq('event_id', EVENT_ID)

    if (resError) console.error('Error deleting reservations:', resError)
    else console.log('✅ Reservations cleared')

    // 6. Reset Tiers
    const { error: tierError } = await supabase
        .schema('gatepass')
        .from('ticket_tiers')
        .update({ quantity_sold: 0 })
        .eq('event_id', EVENT_ID)

    if (tierError) console.error('Error resetting tiers:', tierError)
    else console.log('✅ Ticket Tiers reset')

    // 7. Reset Addons
    const { error: addonError } = await supabase
        .schema('gatepass')
        .from('event_addons')
        .update({ quantity_sold: 0 })
        .eq('event_id', EVENT_ID)

    if (addonError) console.error('Error resetting addons:', addonError)
    else console.log('✅ Addons reset')

    console.log('🎉 Event data cleared!')
}

clearEventData()
