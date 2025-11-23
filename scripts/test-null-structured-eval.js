const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testNullUpdate() {
  const interviewId = '34ebc16c-5c6b-4783-bc1e-1885eeb2e5f1';

  console.log('=== Testing Different Structured Evaluation Values ===\n');

  // Get current value
  const { data: before } = await supabase
    .from('interviews')
    .select('structured_evaluation')
    .eq('id', interviewId)
    .single();

  console.log('Original structured_evaluation exists:', !!before.structured_evaluation);

  // Test 1: Update with undefined
  console.log('\n--- Test 1: undefined ---');
  const result1 = await supabase
    .from('interviews')
    .update({
      score: 99,
      recommendation: 'test',
      structured_evaluation: undefined,
    })
    .eq('id', interviewId);

  console.log('Error:', result1.error);
  console.log('Status:', result1.status);

  const { data: after1 } = await supabase
    .from('interviews')
    .select('score, recommendation, structured_evaluation')
    .eq('id', interviewId)
    .single();

  console.log('After update - Score:', after1.score, 'Recommendation:', after1.recommendation, 'Has SE:', !!after1.structured_evaluation);

  // Test 2: Update with null
  console.log('\n--- Test 2: null ---');
  const result2 = await supabase
    .from('interviews')
    .update({
      score: 98,
      recommendation: 'test2',
      structured_evaluation: null,
    })
    .eq('id', interviewId);

  console.log('Error:', result2.error);
  console.log('Status:', result2.status);

  const { data: after2 } = await supabase
    .from('interviews')
    .select('score, recommendation, structured_evaluation')
    .eq('id', interviewId)
    .single();

  console.log('After update - Score:', after2.score, 'Recommendation:', after2.recommendation, 'Has SE:', !!after2.structured_evaluation);

  // Test 3: Update with empty object
  console.log('\n--- Test 3: empty object {} ---');
  const result3 = await supabase
    .from('interviews')
    .update({
      score: 97,
      recommendation: 'test3',
      structured_evaluation: {},
    })
    .eq('id', interviewId);

  console.log('Error:', result3.error);
  console.log('Status:', result3.status);

  const { data: after3 } = await supabase
    .from('interviews')
    .select('score, recommendation, structured_evaluation')
    .eq('id', interviewId)
    .single();

  console.log('After update - Score:', after3.score, 'Recommendation:', after3.recommendation, 'SE value:', JSON.stringify(after3.structured_evaluation));

  // Restore original
  await supabase
    .from('interviews')
    .update({
      score: before.score || 40,
      recommendation: before.recommendation || 'no',
      structured_evaluation: before.structured_evaluation
    })
    .eq('id', interviewId);

  console.log('\n✅ Restored original values');
}

testNullUpdate().catch(console.error);
