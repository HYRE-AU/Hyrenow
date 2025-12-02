import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { interviewId, transcript } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get interview with questions and competencies
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select(`
        id,
        roles (
          id,
          title,
          jd_text
        )
      `)
      .eq('id', interviewId)
      .single()

    if (interviewError || !interview) throw new Error('Interview not found')

// Get all questions with competencies
const { data: questions, error: questionsError } = await supabase
  .from('questions')
  .select(`
    id,
    text,
    type,
    order_index,
    competencies (
      id,
      name,
      description,
      weight,
      bars_rubric
    )
  `)
      .eq('role_id', (interview.roles as any).id)
      .order('order_index')

    if (questionsError) throw new Error('Failed to fetch questions')

    // Parse transcript to extract Q&A pairs
    const qaMapping = await extractQuestionAnswers(transcript, questions)

    // Process screening questions
    for (const qa of qaMapping.filter((q: any) => q.type === 'screening')) {
      // If answer is long (>8 seconds worth of words, ~16 words per 8 seconds = ~2 words/sec)
      const wordCount = qa.answer.split(' ').length
      const estimatedSeconds = wordCount / 2
      
      let summary = null
      if (estimatedSeconds > 8) {
        summary = await generateScreeningSummary(qa.question, qa.answer)
      }

      await supabase
        .from('screening_summaries')
        .insert({
          interview_id: interviewId,
          question_id: qa.question_id,
          raw_answer: qa.answer,
          summary,
          duration_seconds: Math.round(estimatedSeconds)
        })
    }

    // Process interview questions (evaluate against BARS)
    const evaluations: any[] = []
    for (const qa of qaMapping.filter((q: any) => q.type === 'interview')) {
      const evaluation = await evaluateAgainstBars(
        qa.question,
        qa.answer,
        qa.competency,
        (interview.roles as any).jd_text
      )

      const { error: insertError } = await supabase
        .from('question_evaluations')
        .insert({
          interview_id: interviewId,
          question_id: qa.question_id,
          competency_id: qa.competency.id,
          score: evaluation.score,
          strengths: evaluation.strengths,
          concerns: evaluation.concerns,
          evidence_quotes: evaluation.evidence_quotes,
          why_not_higher_score: evaluation.why_not_higher_score
        })

      if (insertError) {
        console.error('Error inserting question evaluation:', insertError)
      }

      evaluations.push(evaluation)
    }

// Check if we have any evaluations
    if (evaluations.length === 0) {
      throw new Error('No interview questions were evaluated. Please check that interview questions exist for this role.')
    }

    // Get interview questions with their competency weights
    const interviewQAs = qaMapping.filter((q: any) => q.type === 'interview')
    
    // Calculate WEIGHTED score
    let totalWeightedScore = 0
    let totalMaxScore = 0
    const competencyScores: any[] = []
    
    interviewQAs.forEach((qa: any, index: number) => {
      const evaluation = evaluations[index]
      const weight = qa.competency?.weight || 2  // Default to Important if no weight
      const score = evaluation.score || 1
      
      totalWeightedScore += score * weight
      totalMaxScore += 4 * weight
      
      competencyScores.push({
        competency_name: qa.competency?.name || 'Unknown',
        raw_score: score,
        weight: weight,
        weight_label: weight === 3 ? 'critical' : weight === 2 ? 'important' : 'nice_to_have',
        weighted_contribution: score * weight,
        max_contribution: 4 * weight,
        strengths: evaluation.strengths || [],
        concerns: evaluation.concerns || []
      })
    })
    
    const overallScore = Math.round((totalWeightedScore / totalMaxScore) * 100)
    const avgScore = totalWeightedScore / (totalMaxScore / 4)  // For display purposes
    
    // Check for BORDERLINE triggers
    const borderlineTriggers: string[] = []
    
    // 1. High variance check
    const rawScores = competencyScores.map(c => c.raw_score)
    const mean = rawScores.reduce((a, b) => a + b, 0) / rawScores.length
    const variance = rawScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / rawScores.length
    if (variance > 1.5) {
      borderlineTriggers.push('High variance across competencies - performance was inconsistent')
    }
    
    // 2. Critical competency failure check
    const criticalFailures = competencyScores.filter(c => c.weight === 3 && c.raw_score < 2)
    if (criticalFailures.length > 0) {
      borderlineTriggers.push(`Critical competency "${criticalFailures[0].competency_name}" scored below threshold`)
    }
    
    // Determine recommendation with FIVE tiers
    let recommendation: string
    let confidence: string
    
    if (borderlineTriggers.length > 0 && overallScore >= 40 && overallScore < 75) {
      recommendation = 'borderline'
      confidence = 'low'
    } else if (overallScore >= 80) {
      recommendation = 'strong yes'
      confidence = 'high'
    } else if (overallScore >= 65) {
      recommendation = 'yes'
      confidence = variance > 1.0 ? 'moderate' : 'high'
    } else if (overallScore >= 50) {
      recommendation = 'borderline'
      confidence = 'moderate'
    } else if (overallScore >= 35) {
      recommendation = 'no'
      confidence = 'high'
    } else {
      recommendation = 'strong no'
      confidence = 'high'
    }

    // Build reasons and flags
    const allStrengths: string[] = []
    const allConcerns: string[] = []

    evaluations.forEach((evaluation) => {
      if (evaluation.strengths && Array.isArray(evaluation.strengths)) {
        allStrengths.push(...evaluation.strengths)
      }
      if (evaluation.concerns && Array.isArray(evaluation.concerns)) {
        allConcerns.push(...evaluation.concerns)
      }
    })

    // Organize based on recommendation type
    let reasonsToProceed: string[] | null = null
    let flagsRisks: string[] | null = null
    let reasonsNotToProceed: string[] | null = null
    let strengths: string[] | null = null
    let considerationsFor: string[] | null = null
    let considerationsAgainst: string[] | null = null
    let reviewFocus: string | null = null

    if (recommendation === 'strong yes' || recommendation === 'yes') {
      reasonsToProceed = allStrengths.slice(0, 5)
      flagsRisks = allConcerns.slice(0, 5)
    } else if (recommendation === 'borderline') {
      considerationsFor = allStrengths.slice(0, 4)
      considerationsAgainst = allConcerns.slice(0, 4)
      const lowestScoring = [...competencyScores].sort((a, b) => a.raw_score - b.raw_score)[0]
      reviewFocus = `Listen to responses about ${lowestScoring?.competency_name || 'key competencies'} - this is where signals were mixed.`
    } else {
      reasonsNotToProceed = allConcerns.slice(0, 5)
      strengths = allStrengths.slice(0, 5)
    }

    // Extract competencies that were evaluated
    const evaluatedCompetencies = questions
      .filter((q: any) => q.type === 'interview' && q.competencies)
      .map((q: any) => q.competencies.name)
      .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index) // unique
      .join(', ')

// Generate recommendation rationale using LLM
    let rationalePrompt: string
    
    if (recommendation === 'borderline') {
      rationalePrompt = `Based on this interview evaluation, write a 2-3 sentence explanation for why this candidate is BORDERLINE and requires human review.

Role: ${(interview.roles as any).title}
Weighted Score: ${overallScore}%
Borderline Triggers: ${borderlineTriggers.join('; ') || 'Score fell in borderline range'}

Key Strengths: ${allStrengths.slice(0, 3).join('; ') || 'None identified'}
Key Concerns: ${allConcerns.slice(0, 3).join('; ') || 'None identified'}

Write a balanced rationale that:
1. Acknowledges what the candidate did well
2. Explains the specific concerns or inconsistencies
3. Suggests what a human reviewer should focus on`
    } else {
      rationalePrompt = `Based on this interview evaluation, write a 2-3 sentence explanation of WHY we recommend "${recommendation}" for this candidate.

Role: ${(interview.roles as any).title}
Competencies Evaluated: ${evaluatedCompetencies}
Weighted Score: ${overallScore}%

Key Strengths: ${allStrengths.slice(0, 3).join('; ') || 'None identified'}
Key Concerns: ${allConcerns.slice(0, 3).join('; ') || 'None identified'}

Write a concise, specific rationale that connects their competency performance to the role requirements.`
    }

    const rationaleCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a hiring expert. Write clear, concise explanations for hiring recommendations that directly connect candidate performance to job requirements. Focus on how they will perform in the actual role responsibilities. Write in 2-3 sentences.'
        },
        {
          role: 'user',
          content: rationalePrompt
        }
      ],
      temperature: 0.5,
      max_tokens: 200
    })

    const recommendationRationale = rationaleCompletion.choices[0].message.content?.trim() || 
      `Based on the evaluation, we recommend "${recommendation}" for this candidate.`

    // Build question evaluations for UI
    const questionEvaluations = qaMapping
      .filter((qa: any) => qa.type === 'interview')
      .map((qa: any, index: number) => {
        const evaluationData = evaluations[index]
        const wordCount = qa.answer.split(' ').length
        const durationSeconds = Math.round(wordCount / 2)

        // Build a meaningful evaluation summary
        let evaluationSummary = 'No evaluation available'
        if (evaluationData) {
          const score = evaluationData.score || 0
          const hasStrengths = evaluationData.strengths?.length > 0
          const hasConcerns = evaluationData.concerns?.length > 0

          if (hasStrengths) {
            // If there are strengths, show them
            evaluationSummary = evaluationData.strengths.join('. ')
          } else if (hasConcerns) {
            // If no strengths but has concerns, show score context + main concern
            const scoreLabel = score <= 1 ? 'Below expectations' : score === 2 ? 'Partially meets expectations' : 'Meets expectations'
            evaluationSummary = `${scoreLabel}: ${evaluationData.concerns[0]}`
          } else if (score) {
            // Fallback to just score description
            evaluationSummary = score <= 1 ? 'Response did not demonstrate the required competency' :
                               score === 2 ? 'Response partially demonstrated the competency' :
                               score === 3 ? 'Response adequately demonstrated the competency' :
                               'Response strongly demonstrated the competency'
          }
        }

        return {
          question: qa.question,
          evaluation: evaluationSummary,
          answer_duration_seconds: durationSeconds,
          score: evaluationData?.score || null
        }
      })

const structuredEvaluation = {
      recommendation,
      confidence,
      recommendation_rationale: recommendationRationale,
      reasons_to_proceed: reasonsToProceed,
      flags_risks: flagsRisks,
      reasons_not_to_proceed: reasonsNotToProceed,
      strengths: strengths,
      considerations_for: considerationsFor,
      considerations_against: considerationsAgainst,
      review_focus: reviewFocus,
      borderline_triggers: borderlineTriggers.length > 0 ? borderlineTriggers : null,
      competency_scores: competencyScores,
      question_evaluations: questionEvaluations
    }

    // Update interview with overall results
    console.log('Updating interview with structured evaluation...')
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        score: overallScore,
        recommendation,
        structured_evaluation: structuredEvaluation,
        status: 'completed'
      })
      .eq('id', interviewId)

    if (updateError) {
      console.error('Error updating interview with structured evaluation:', updateError)
      throw new Error(`Failed to save evaluation results: ${updateError.message}`)
    }

    console.log('Successfully saved structured evaluation to interview')

    return NextResponse.json({
      success: true,
      recommendation,
      score: overallScore
    })
  } catch (error: any) {
    console.error('Evaluation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

async function extractQuestionAnswers(transcript: string, questions: any[]) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extract the candidate's answers to each interview question from the transcript.

Return ONLY valid JSON in this format:
{
  "qa_pairs": [
    {
      "question_index": 0,
      "answer": "The candidate's full answer to this question"
    }
  ]
}

Match questions by semantic similarity. If a question wasn't answered, use empty string for answer.`
      },
      {
        role: 'user',
        content: `Questions:\n${questions.map((q, i) => `${i}. ${q.text}`).join('\n')}\n\nTranscript:\n${transcript}`
      }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  })

  const result = JSON.parse(completion.choices[0].message.content || '{}')
  
  return result.qa_pairs.map((pair: any) => ({
    question_id: questions[pair.question_index].id,
    question: questions[pair.question_index].text,
    answer: pair.answer,
    type: questions[pair.question_index].type,
    competency: questions[pair.question_index].competencies
  }))
}

async function generateScreeningSummary(question: string, answer: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Summarize the candidate\'s answer in 1-2 concise sentences. Focus on key facts only.'
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nAnswer: ${answer}\n\nProvide a brief summary:`
      }
    ],
    temperature: 0.3,
    max_tokens: 100
  })

  return completion.choices[0].message.content?.trim() || ''
}

async function evaluateAgainstBars(
  question: string, 
  answer: string, 
  competency: any,
  jobDescription: string
) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert interviewer evaluating a candidate's answer against a BARS (Behaviorally Anchored Rating Scale) rubric.

Evaluate the answer objectively based on:
- Concrete behaviors and examples provided
- Evidence of the competency in action
- Depth and quality of the response

Return ONLY valid JSON:
{
  "score": 1-4,
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "concerns": ["Specific concern 1", "Specific concern 2"],
  "evidence_quotes": ["Direct quote from answer that supports score"],
  "why_not_higher_score": "Specific explanation of what would be needed for the next level"
}

Focus on observable behaviors, not assumptions about the person.`
      },
      {
        role: 'user',
        content: `Competency: ${competency.name}
Description: ${competency.description}

BARS Rubric:
${JSON.stringify(competency.bars_rubric, null, 2)}

Job Context:
${jobDescription}

Question: ${question}

Candidate's Answer: ${answer}

Evaluate this answer:`
      }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}