const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xamnsuiqpmrgzuveouep.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbW5zdWlxcG1yZ3p1dmVvdWVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY0NDgxNCwiZXhwIjoyMDc5MjIwODE0fQ.J0dlsOHcH_OdIYfF7Nqg-tQ1ws44M9elMyLyl9xxa1U'
);

async function testFeedbackFlow() {
  console.log('🔍 Testing feedback submission flow...\n');

  // Get a recent completed interview
  const { data: interviews, error: interviewsError } = await supabase
    .from('interviews')
    .select('id, slug, status')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5);

  if (interviewsError) {
    console.error('❌ Error fetching interviews:', interviewsError);
    return;
  }

  console.log('✅ Found completed interviews:');
  console.log(interviews);

  if (interviews.length === 0) {
    console.log('⚠️ No completed interviews found to test with.');
    return;
  }

  const testInterview = interviews[0];
  console.log(`\n🧪 Testing with interview: ${testInterview.slug} (ID: ${testInterview.id})\n`);

  // Check if this interview already has feedback
  const { data: existingFeedback, error: feedbackCheckError } = await supabase
    .from('interview_feedback')
    .select('*')
    .eq('interview_id', testInterview.id);

  if (feedbackCheckError) {
    console.error('❌ Error checking existing feedback:', feedbackCheckError);
  } else {
    console.log('📊 Existing feedback for this interview:');
    console.log(existingFeedback);
  }

  // Try to simulate what the API does
  console.log('\n🚀 Simulating API insert...');
  const { data: insertResult, error: insertError } = await supabase
    .from('interview_feedback')
    .insert({
      interview_id: testInterview.id,
      rating: 5,
      feedback_text: 'Test feedback from debugging script'
    })
    .select();

  if (insertError) {
    console.error('❌ Insert failed:', insertError);
  } else {
    console.log('✅ Insert succeeded:');
    console.log(insertResult);

    // Clean up
    if (insertResult && insertResult[0]) {
      console.log('\n🧹 Cleaning up test record...');
      await supabase
        .from('interview_feedback')
        .delete()
        .eq('id', insertResult[0].id);
      console.log('✅ Test record deleted');
    }
  }

  // Check all feedback in the table
  console.log('\n📋 All feedback records in the database:');
  const { data: allFeedback, error: allError } = await supabase
    .from('interview_feedback')
    .select('id, interview_id, rating, feedback_text, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allError) {
    console.error('❌ Error:', allError);
  } else {
    console.log(allFeedback);
  }
}

testFeedbackFlow().catch(console.error);
