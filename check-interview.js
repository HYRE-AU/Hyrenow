const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xamnsuiqpmrgzuveouep.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbW5zdWlxcG1yZ3p1dmVvdWVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY0NDgxNCwiZXhwIjoyMDc5MjIwODE0fQ.J0dlsOHcH_OdIYfF7Nqg-tQ1ws44M9elMyLyl9xxa1U'
);

async function analyzeInterviewFeedback() {
  console.log('📊 COMPREHENSIVE INTERVIEW FEEDBACK ANALYSIS\n');
  console.log('=' .repeat(80));

  // Get all interviews
  const { data: allInterviews, error: interviewsError } = await supabase
    .from('interviews')
    .select('id, slug, status, created_at, completed_at')
    .order('created_at', { ascending: false });

  if (interviewsError) {
    console.error('❌ Error fetching interviews:', interviewsError);
    return;
  }

  console.log(`\n📋 TOTAL INTERVIEWS: ${allInterviews.length}\n`);

  const statusCounts = allInterviews.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });

  // Get all feedback
  const { data: allFeedback, error: feedbackError } = await supabase
    .from('interview_feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (feedbackError) {
    console.error('❌ Error fetching feedback:', feedbackError);
    return;
  }

  console.log(`\n💬 TOTAL FEEDBACK RECORDS: ${allFeedback.length}\n`);
  console.log('=' .repeat(80));

  // Check completed interviews
  const completedInterviews = allInterviews.filter(i => i.status === 'completed');
  console.log(`\n✅ COMPLETED INTERVIEWS: ${completedInterviews.length}\n`);

  if (completedInterviews.length > 0) {
    console.log('Analyzing each completed interview:\n');

    for (const interview of completedInterviews) {
      const feedback = allFeedback.find(f => f.interview_id === interview.id);
      const hasFeedback = !!feedback;

      console.log(`${hasFeedback ? '✅' : '❌'} Interview: ${interview.slug}`);
      console.log(`   ID: ${interview.id}`);
      console.log(`   Completed: ${interview.completed_at}`);
      console.log(`   Has Feedback: ${hasFeedback ? 'YES' : 'NO'}`);

      if (hasFeedback) {
        console.log(`   Rating: ${feedback.rating}/5`);
        console.log(`   Feedback: "${feedback.feedback_text || '(no text)'}"`);
        console.log(`   Submitted: ${feedback.created_at}`);
      } else {
        console.log(`   ⚠️ MISSING FEEDBACK - This is the issue!`);
      }
      console.log('');
    }

    const feedbackRate = (allFeedback.length / completedInterviews.length * 100).toFixed(1);
    console.log('=' .repeat(80));
    console.log(`\n📈 FEEDBACK RATE: ${allFeedback.length}/${completedInterviews.length} (${feedbackRate}%)\n`);

    if (allFeedback.length < completedInterviews.length) {
      const missing = completedInterviews.length - allFeedback.length;
      console.log(`⚠️ WARNING: ${missing} completed interview(s) are missing feedback!\n`);
      console.log('Possible reasons:');
      console.log('1. Candidates completed interview but didn\'t submit the survey');
      console.log('2. Survey form is not showing up after interview completion');
      console.log('3. API error when submitting feedback (check browser console)');
      console.log('4. Survey submission is failing silently\n');
    }
  }

  // Show most recent feedback
  if (allFeedback.length > 0) {
    console.log('=' .repeat(80));
    console.log('\n📝 MOST RECENT FEEDBACK:\n');
    allFeedback.slice(0, 3).forEach((fb, i) => {
      console.log(`${i + 1}. Rating: ${fb.rating}/5`);
      console.log(`   Text: "${fb.feedback_text || '(none)'}"`);
      console.log(`   Submitted: ${fb.created_at}`);
      console.log(`   Interview ID: ${fb.interview_id}\n`);
    });
  }
}

analyzeInterviewFeedback().catch(console.error);
