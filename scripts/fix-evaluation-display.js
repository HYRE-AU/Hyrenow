/**
 * Fix the structured_evaluation display for existing interviews
 * This rebuilds the question_evaluations array from the question_evaluations table
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixEvaluationDisplay(interviewId) {
  console.log('Fixing evaluation display for interview:', interviewId);

  // Get the interview
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select('id, structured_evaluation')
    .eq('id', interviewId)
    .single();

  if (interviewError || !interview) {
    console.error('Interview not found:', interviewError);
    return;
  }

  // Get the question evaluations
  const { data: evals, error: evalsError } = await supabase
    .from('question_evaluations')
    .select('*, questions(text, order_index)')
    .eq('interview_id', interviewId)
    .order('questions(order_index)');

  if (evalsError) {
    console.error('Error fetching evaluations:', evalsError);
    return;
  }

  console.log(`Found ${evals.length} question evaluations`);

  // Rebuild question_evaluations with better summaries
  const questionEvaluations = evals.map(evalData => {
    const score = evalData.score || 0;
    const hasStrengths = evalData.strengths?.length > 0;
    const hasConcerns = evalData.concerns?.length > 0;

    let evaluationSummary = 'No evaluation available';

    if (hasStrengths) {
      evaluationSummary = evalData.strengths.join('. ');
    } else if (hasConcerns) {
      const scoreLabel = score <= 1 ? 'Below expectations' : score === 2 ? 'Partially meets expectations' : 'Meets expectations';
      evaluationSummary = `${scoreLabel}: ${evalData.concerns[0]}`;
    } else if (score) {
      evaluationSummary = score <= 1 ? 'Response did not demonstrate the required competency' :
                         score === 2 ? 'Response partially demonstrated the competency' :
                         score === 3 ? 'Response adequately demonstrated the competency' :
                         'Response strongly demonstrated the competency';
    }

    return {
      question: evalData.questions?.text || 'Question not found',
      evaluation: evaluationSummary,
      answer_duration_seconds: interview.structured_evaluation?.question_evaluations?.find(
        q => q.question === evalData.questions?.text
      )?.answer_duration_seconds || 0,
      score: score
    };
  });

  // Update structured_evaluation
  const updatedEvaluation = {
    ...interview.structured_evaluation,
    question_evaluations: questionEvaluations
  };

  const { error: updateError } = await supabase
    .from('interviews')
    .update({ structured_evaluation: updatedEvaluation })
    .eq('id', interviewId);

  if (updateError) {
    console.error('Error updating:', updateError);
    return;
  }

  console.log('Updated evaluation display:');
  questionEvaluations.forEach((q, i) => {
    console.log(`  Q${i + 1}: ${q.evaluation.substring(0, 60)}...`);
  });
}

// Fix specific interview
const interviewId = process.argv[2] || '7cb84929-581b-4532-bc4d-2c4c90944b92';
fixEvaluationDisplay(interviewId);
