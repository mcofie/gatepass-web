/* eslint-disable */
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // specific key for admin rights

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearData() {
    console.log('⚠️  Starting cleanup of Payments, Tickets, and Reservations...')

    // 0. Delete Ticket Transfers (Child of Tickets)
    const { error: transferError } = await supabase
        .schema('gatepass')
        .from('ticket_transfers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (transferError) console.error('Error deleting ticket transfers:', transferError)
    else console.log('✅ Ticket Transfers cleared')

    // 1. Delete Transactions (Payments)
    const { error: txError } = await supabase
        .schema('gatepass')
        .from('transactions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all not matching a dummy UUID (effectively all)

    if (txError) console.error('Error deleting transactions:', txError)
    else console.log('✅ Transactions cleared')

    // 2. Delete Tickets
    const { error: ticketError } = await supabase
        .schema('gatepass')
        .from('tickets')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (ticketError) console.error('Error deleting tickets:', ticketError)
    else console.log('✅ Tickets cleared')

    // 2.5 Delete Payouts (Organizer Payments)
    const { error: payoutError } = await supabase
        .schema('gatepass')
        .from('payouts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (payoutError) console.error('Error deleting payouts:', payoutError)
    else console.log('✅ Payouts cleared')

    // 3. Delete Reservations (Orders)
    const { error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (resError) console.error('Error deleting reservations:', resError)
    else console.log('✅ Reservations cleared')

    // 4. Reset Ticket Tiers Quantity Sold
    // We update all rows to have quantity_sold = 0
    // Supabase update without a where clause (or with a broad one)
    const { error: tierError } = await supabase
        .schema('gatepass')
        .from('ticket_tiers')
        .update({ quantity_sold: 0 })
        .gt('quantity_sold', 0) // Update only those that need it

    if (tierError) console.error('Error resetting ticket tiers:', tierError)
    else console.log('✅ Ticket Tiers quantity_sold reset')

    // 5. Reset Event Addons Quantity Sold
    const { error: addonError } = await supabase
        .schema('gatepass')
        .from('event_addons')
        .update({ quantity_sold: 0 })
        .gt('quantity_sold', 0)

    if (addonError) console.error('Error resetting event addons:', addonError)
    else console.log('✅ Event Addons quantity_sold reset')

    // 6. Reset Discount Usage
    const { error: discountError } = await supabase
        .schema('gatepass')
        .from('discounts')
        .update({ used_count: 0 })
        .gt('used_count', 0)

    if (discountError) console.error('Error resetting discounts:', discountError)
    else console.log('✅ Discounts used_count reset')

    console.log('🎉 Cleanup complete!')
}

clearData()
