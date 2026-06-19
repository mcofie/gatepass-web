require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("--- 1. LATEST RESERVATION ---");
  const { data: latestReservations, error: rError } = await supabase
    .schema('gatepass')
    .from('reservations')
    .select('*, events(*)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (rError) {
    console.error("Error fetching reservation:", rError);
    return;
  }
  
  if (!latestReservations || latestReservations.length === 0) {
    console.log("No reservations found.");
    return;
  }

  const reservation = latestReservations[0];
  console.log(`Reservation ID: ${reservation.id}`);
  console.log(`Event ID: ${reservation.event_id}`);
  console.log(`Event Title: ${reservation.events?.title}`);
  console.log(`Created At: ${reservation.created_at}`);
  console.log(`Status: ${reservation.status}`);

  console.log("\n--- 2. QUESTIONS FOR THIS EVENT ---");
  const { data: questions, error: qError } = await supabase
    .schema('gatepass')
    .from('event_form_questions')
    .select('*')
    .eq('event_id', reservation.event_id)
    .order('sort_order', { ascending: true });

  if (qError) {
    console.error("Error fetching questions:", qError);
  } else {
    console.log(`Found ${questions.length} questions:`);
    questions.forEach(q => {
      console.log(` - ID: ${q.id}, Type: ${q.type}, Required: ${q.required}, Label: "${q.label}"`);
    });
  }

  console.log("\n--- 3. ALL REGISTERED QUESTIONS IN event_form_questions ---");
  const { data: allQuestions, error: allqError } = await supabase
    .schema('gatepass')
    .from('event_form_questions')
    .select('*');
  
  if (allqError) {
    console.error("Error fetching all questions:", allqError);
  } else {
    console.log(`Total questions in DB: ${allQuestions.length}`);
    allQuestions.forEach(q => {
      console.log(` - Event ID: ${q.event_id}, ID: ${q.id}, Type: ${q.type}, Label: "${q.label}"`);
    });
  }

  console.log("\n--- 4. RESPONSES FOR THIS RESERVATION ---");
  const { data: responses, error: respError } = await supabase
    .schema('gatepass')
    .from('event_form_responses')
    .select('*')
    .eq('reservation_id', reservation.id);

  if (respError) {
    console.error("Error fetching responses:", respError);
  } else {
    console.log(`Found ${responses.length} responses for this reservation.`);
    responses.forEach(r => {
      console.log(` - Question ID: ${r.question_id}, Answer: "${r.answer}"`);
    });
  }
}

run();
