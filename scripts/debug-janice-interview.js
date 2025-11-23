const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkJaniceInterview() {
  // Get Janice's candidate ID
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, name, email')
    .eq('email', 'hyre.analysis@gmail.com')
    .single();

  console.log('Candidate:', candidate.name);

  // Get ALL interviews for this candidate
  const { data: interviews } = await supabase
    .from('interviews')
    .select('id, status, completed_at, score, recommendation, structured_evaluation, duration_seconds, created_at')
    .eq('candidate_id', candidate.id)
    .order('created_at', { ascending: false });

  console.log('\n=== All Interviews ===');
  interviews.forEach((interview, i) => {
    console.log(`\n${i + 1}. Interview ${interview.id.substring(0, 8)}...`);
    console.log('   Status:', interview.status);
    console.log('   Created:', interview.created_at);
    console.log('   Completed:', interview.completed_at);
    console.log('   Duration:', interview.duration_seconds, 'sec');
    console.log('   Score:', interview.score);
    console.log('   Recommendation:', interview.recommendation);
    console.log('   Has structured_evaluation:', interview.structured_evaluation ? 'YES' : 'NO');
  });

  // Check the most recent completed one
  const completedInterviews = interviews.filter(i => i.status === 'completed');
  if (completedInterviews.length > 0) {
    const latest = completedInterviews[0];
    console.log('\n=== Latest Completed Interview ===');
    console.log('ID:', latest.id);

    // Check question evaluations
    const { data: qevals } = await supabase
      .from('question_evaluations')
      .select('id, score')
      .eq('interview_id', latest.id);

    console.log('Question evaluations:', qevals?.length || 0);

    if (!latest.structured_evaluation) {
      console.log('\n❌ PROBLEM: No structured_evaluation field');
      console.log('This is the same bug - evaluation did not save properly');
    } else {
      console.log('\n✓ Structured evaluation exists');
      console.log(JSON.stringify(latest.structured_evaluation, null, 2));
    }
  }
}

checkJaniceInterview().catch(console.error);
