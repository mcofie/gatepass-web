require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    console.log('Fetching 1 ticket...');
    const { data: tickets, error } = await supabase
        .schema('gatepass')
        .from('tickets')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (tickets.length === 0) {
        console.log('No tickets found.');
    } else {
        console.log('Ticket keys:', Object.keys(tickets[0]));
        console.log('First ticket:', tickets[0]);
    }

    console.log('\nFetching 1 reservation...');
    const { data: reservations, error: resError } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('*')
        .limit(1);

    if (resError) {
        console.error('Error fetching reservations:', resError);
    } else {
        console.log('Reservation keys:', Object.keys(reservations[0] || {}));
        console.log('First reservation:', reservations[0]);
    }
}

main();
