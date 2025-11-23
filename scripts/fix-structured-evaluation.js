const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fix() {
  const interviewId = '34ebc16c-5c6b-4783-bc1e-1885eeb2e5f1';

  // Get question evaluations
  const { data: evals } = await supabase
    .from('question_evaluations')
    .select(`
      score,
      strengths,
      concerns,
      evidence_quotes,
      why_not_higher_score,
      questions(text)
    `)
    .eq('interview_id', interviewId);

  if (!evals || evals.length === 0) {
    console.error('No evaluations found');
    return;
  }

  console.log('Found', evals.length, 'evaluations');

  // Build structured evaluation
  const reasonsToProceed = [];
  const flagsRisks = [];

  evals.forEach(e => {
    if (e.strengths && Array.isArray(e.strengths)) {
      reasonsToProceed.push(...e.strengths);
    }
    if (e.concerns && Array.isArray(e.concerns)) {
      flagsRisks.push(...e.concerns);
    }
  });

  const questionEvaluations = evals.map((e, index) => {
    // Use the first strength or concern as the evaluation summary
    const evaluation =
      e.strengths && e.strengths.length > 0
        ? e.strengths[0]
        : (e.concerns && e.concerns.length > 0
            ? `Concern: ${e.concerns[0]}`
            : 'No evaluation available');

    return {
      question: e.questions.text,
      evaluation: evaluation,
      answer_duration_seconds: 0 // Placeholder - actual duration not available from stored data
    };
  });

  const avgScore = evals.reduce((sum, e) => sum + e.score, 0) / evals.length;
  const recommendation =
    avgScore >= 3.5 ? 'strong yes' :
    avgScore >= 2.5 ? 'yes' :
    avgScore >= 1.5 ? 'no' : 'strong no';

  const structuredEvaluation = {
    recommendation,
    reasons_to_proceed: reasonsToProceed,
    flags_risks: flagsRisks,
    question_evaluations: questionEvaluations
  };

  console.log('\nReconstructed structured_evaluation:');
  console.log(JSON.stringify(structuredEvaluation, null, 2));

  // Update interview with structured evaluation
  const { data, error } = await supabase
    .from('interviews')
    .update({
      structured_evaluation: structuredEvaluation
    })
    .eq('id', interviewId)
    .select();

  if (error) {
    console.error('\n❌ Error updating interview:', error);
  } else {
    console.log('\n✅ Successfully updated interview with structured_evaluation');
  }
}

fix().catch(console.error);
