const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testUpdate() {
  const interviewId = '34ebc16c-5c6b-4783-bc1e-1885eeb2e5f1';

  console.log('=== Testing Update Behavior ===\n');

  // First, get the current state
  const { data: before } = await supabase
    .from('interviews')
    .select('score, recommendation, structured_evaluation')
    .eq('id', interviewId)
    .single();

  console.log('BEFORE test update:');
  console.log('- Score:', before.score);
  console.log('- Recommendation:', before.recommendation);
  console.log('- Has structured_evaluation:', !!before.structured_evaluation);

  // Now test the update WITHOUT .select() - like the original code
  console.log('\n--- Test 1: Update WITHOUT .select() ---');
  const testEval = {
    test: 'This is a test structured evaluation',
    timestamp: new Date().toISOString()
  };

  const result1 = await supabase
    .from('interviews')
    .update({
      structured_evaluation: testEval
    })
    .eq('id', interviewId);

  console.log('Update result (without select):');
  console.log('- Error:', result1.error);
  console.log('- Data:', result1.data);
  console.log('- Status:', result1.status);
  console.log('- StatusText:', result1.statusText);

  // Verify it was saved
  const { data: after1 } = await supabase
    .from('interviews')
    .select('structured_evaluation')
    .eq('id', interviewId)
    .single();

  console.log('\nVerification after update:');
  console.log('- Structured_evaluation saved?', !!after1.structured_evaluation);
  if (after1.structured_evaluation) {
    console.log('- Content:', JSON.stringify(after1.structured_evaluation).substring(0, 100));
  }

  // Restore the original structured_evaluation
  await supabase
    .from('interviews')
    .update({
      structured_evaluation: before.structured_evaluation
    })
    .eq('id', interviewId);

  console.log('\n✅ Restored original structured_evaluation');

  // Now test WITH .select() - like the new code
  console.log('\n--- Test 2: Update WITH .select() ---');
  const result2 = await supabase
    .from('interviews')
    .update({
      structured_evaluation: testEval
    })
    .eq('id', interviewId)
    .select();

  console.log('Update result (with select):');
  console.log('- Error:', result2.error);
  console.log('- Data returned:', !!result2.data);
  console.log('- Status:', result2.status);

  // Restore again
  await supabase
    .from('interviews')
    .update({
      structured_evaluation: before.structured_evaluation
    })
    .eq('id', interviewId);

  console.log('\n✅ Test complete - original data restored');
}

testUpdate().catch(console.error);
