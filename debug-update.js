/* eslint-disable */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

try {
    const envConfig = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            process.env[key.trim()] = value.trim()
        }
    })
} catch (e) {
    console.error('Could not read .env.local', e)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Simulating Admin Client

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpdate() {
    console.log('--- Starting Debug Update ---')

    // 1. Create a Test Event (if needed, or just use existing)
    // Actually, let's just create a raw discount directly linked to a dummy UUID event_id if constraints allow, or fetch an existing event.

    const { data: events } = await supabase.schema('gatepass').from('events').select('id').limit(1)
    if (!events || events.length === 0) {
        console.error('No events found to attach discount to.')
        return
    }
    const eventId = events[0].id
    console.log('Using Event ID:', eventId)

    // 2. Create Discount
    const code = 'DEBUG_' + Math.random().toString(36).substring(7).toUpperCase()
    console.log('Creating Discount:', code)

    const { data: discount, error: discError } = await supabase.schema('gatepass').from('discounts').insert({
        event_id: eventId,
        code: code,
        type: 'fixed',
        value: 10,
        used_count: 0
    }).select().single()

    if (discError) {
        console.error('Failed to create discount:', discError)
        return
    }
    console.log('Discount Created:', discount.id)

    // 3. Create Reservation with Discount
    // We need a tier first
    const { data: tiers } = await supabase.schema('gatepass').from('ticket_tiers').select('id, price').eq('event_id', eventId).limit(1)
    if (!tiers || tiers.length === 0) {
        console.error('No tiers found.')
        return
    }
    const tierId = tiers[0].id

    console.log('Creating Reservation with Discount ID:', discount.id)

    const { data: reservation, error: resError } = await supabase.schema('gatepass').from('reservations').insert({
        event_id: eventId,
        tier_id: tierId,
        quantity: 1,
        status: 'pending',
        guest_email: 'debug@test.com',
        guest_name: 'Debug User',
        discount_id: discount.id // CRITICAL STEP
    }).select().single()

    if (resError) {
        console.error('Failed to create reservation:', resError)
        return
    }
    console.log('Reservation Created:', reservation.id, 'Discount ID in DB:', reservation.discount_id)

    if (reservation.discount_id !== discount.id) {
        console.error('CRITICAL: Discount ID mismatch in reservation!', reservation.discount_id, 'vs', discount.id)
        return
    }

    // 4. Simulate Payment Update Logic
    console.log('Simulating Payment Update...')

    if (reservation.discount_id) {
        const { data: d } = await supabase.schema('gatepass').from('discounts').select('used_count').eq('id', reservation.discount_id).single()
        console.log('Current Used Count:', d.used_count)

        if (d) {
            const { error: updateError } = await supabase.schema('gatepass').from('discounts').update({ used_count: d.used_count + 1 }).eq('id', reservation.discount_id)
            if (updateError) {
                console.error('Update Failed:', updateError)
            } else {
                console.log('Update Success!')
            }
        }
    }

    // 5. Verify Final Count
    const { data: finalDiscount } = await supabase.schema('gatepass').from('discounts').select('used_count').eq('id', discount.id).single()
    console.log('Final Used Count:', finalDiscount.used_count)

    // Cleanup
    await supabase.schema('gatepass').from('reservations').delete().eq('id', reservation.id)
    await supabase.schema('gatepass').from('discounts').delete().eq('id', discount.id)
    console.log('Cleanup Done')
}

testUpdate()
