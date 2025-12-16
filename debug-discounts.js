/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envConfig = fs.readFileSync(path.resolve('.env.local'), 'utf8');
envConfig.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim();
    }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReservations() {
    console.log('Checking last 5 reservations...');
    const { data: reservations, error } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('id, user_id, status, discount_id, created_at, discounts(code, used_count)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching reservations:', error);
        return;
    }

    console.log(JSON.stringify(reservations, null, 2));
}

checkReservations();
