const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xamnsuiqpmrgzuveouep.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbW5zdWlxcG1yZ3p1dmVvdWVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY0NDgxNCwiZXhwIjoyMDc5MjIwODE0fQ.J0dlsOHcH_OdIYfF7Nqg-tQ1ws44M9elMyLyl9xxa1U'
);

async function checkSchema() {
  console.log('🔍 Checking interview_feedback table schema...\n');

  // Try to query the table structure
  const { data: tableData, error: tableError } = await supabase
    .from('interview_feedback')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ Error querying interview_feedback table:');
    console.error(tableError);
  } else {
    console.log('✅ Table exists. Sample data (if any):');
    console.log(tableData);
  }

  // Check interviews table structure
  console.log('\n🔍 Checking interviews table for id field...\n');
  const { data: interviewData, error: interviewError } = await supabase
    .from('interviews')
    .select('id, slug')
    .limit(1);

  if (interviewError) {
    console.error('❌ Error querying interviews table:');
    console.error(interviewError);
  } else {
    console.log('✅ Sample interview record:');
    console.log(interviewData);
  }

  // Try to insert a test feedback record to see what error we get
  console.log('\n🧪 Attempting test insert to see error...\n');
  const { data: insertData, error: insertError } = await supabase
    .from('interview_feedback')
    .insert({
      interview_id: '00000000-0000-0000-0000-000000000000', // fake UUID
      rating: 5,
      feedback_text: 'test'
    })
    .select();

  if (insertError) {
    console.error('❌ Insert error (expected):');
    console.error(insertError);
  } else {
    console.log('✅ Insert succeeded (unexpected):');
    console.log(insertData);

    // Clean up the test record
    if (insertData && insertData[0]) {
      await supabase
        .from('interview_feedback')
        .delete()
        .eq('feedback_text', 'test');
      console.log('🧹 Cleaned up test record');
    }
  }
}

checkSchema().catch(console.error);
