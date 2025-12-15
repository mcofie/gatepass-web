const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8').split('\n');
    envConfig.forEach((line) => {
        const [key, ...values] = line.split('=');
        const value = values.join('=');
        if (key && value) {
            let val = value.trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            process.env[key.trim()] = val;
        }
    });
}

// Use Public Key (Anon) to simulate client-side behavior
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAnonUpdate() {
    console.log('Testing Anonymous Reservation Update...');

    // 1. Create Reservation (Simulate Guest)
    // Need valid IDs first. Let's assume we have them or pick random?
    // We'll pick an event and tier from DB using Service Role just to get started.
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: event } = await adminClient.schema('gatepass').from('events').select('id').limit(1).single();
    const { data: tier } = await adminClient.schema('gatepass').from('ticket_tiers').select('id').eq('event_id', event.id).limit(1).single();
    const { data: discount } = await adminClient.schema('gatepass').from('discounts').select('id').eq('event_id', event.id).limit(1).single();

    if (!event || !tier || !discount) {
        console.error('Missing data to test (needs event, tier, discount).');
        return;
    }

    console.log('Found Event:', event.id);

    // Create with Anon
    const { data: reservation, error: createError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .insert({
            event_id: event.id,
            tier_id: tier.id,
            quantity: 1,
            status: 'pending',
            guest_email: 'test@anon.com',
            guest_name: 'Anon Tester'
        })
        .select()
        .single();

    if (createError) {
        console.error('Anon Create Failed:', createError);
        return;
    }

    console.log('Anon Created Reservation:', reservation.id);

    // 2. Try Update
    console.log('Attempting to update discount_id as Anon...');
    const { error: updateError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .update({ discount_id: discount.id })
        .eq('id', reservation.id);

    if (updateError) {
        console.error('Anon Update FAILED:', updateError); // Expected result
    } else {
        // Verify it actually updated (sometimes RLS silent fail returns no error but 0 rows)
        const { data: verify } = await adminClient.schema('gatepass').from('reservations').select('discount_id').eq('id', reservation.id).single();
        if (verify.discount_id === discount.id) {
            console.log('Anon Update SUCCESS!');
        } else {
            console.error('Anon Update SILENT FAIL (0 rows updated).');
        }
    }
}

testAnonUpdate();
