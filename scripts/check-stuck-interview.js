const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAndFix() {
  const slug = '1W7rdD8w1G';

  const { data } = await supabase
    .from('interviews')
    .select('id, status, vapi_call_id, started_at, completed_at, slug')
    .eq('slug', slug)
    .single();

  console.log('=== Interview Status ===');
  console.log('Slug:', data.slug);
  console.log('Status:', data.status);
  console.log('Vapi Call ID:', data.vapi_call_id || 'none');
  console.log('Started:', data.started_at);
  console.log('Completed:', data.completed_at);

  if (data.status === 'in_progress' && !data.completed_at) {
    console.log('\n⚠️  Interview is stuck in "in_progress" state');
    console.log('This happens when the Vapi call ended without triggering the webhook.');
    console.log('\nWould you like to reset it to "invited" status? (y/n)');
    console.log('\nTo reset manually, run:');
    console.log(`
    UPDATE interviews
    SET status = 'invited', started_at = NULL, vapi_call_id = NULL
    WHERE id = '${data.id}';
    `);
  }
}

checkAndFix().catch(console.error);
