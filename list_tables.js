const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function debug() {
  const { data, error } = await supabase.rpc('get_tables_info', {})
  if (error) {
     // fallback if rpc doesn't exist
     const { data: d2, error: e2 } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'gatepass')
     console.log('Tables in gatepass:', d2)
     console.log('Error:', e2)
  } else {
     console.log('Tables:', data)
  }
}
debug()
