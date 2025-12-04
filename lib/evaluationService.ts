/**
 * Evaluation Service
 *
 * Core evaluation logic extracted from the evaluate endpoint.
 * Used by both the cron job and the manual evaluate endpoint.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { logError } from '@/lib/errorLogger'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface EvaluationResult {
  success: boolean
  recommendation?: string
  score?: number
  error?: string
}

/**
 * Process a complete evaluation for an interview
 */
export async function processEvaluation(
  interviewId: string,
  transcript: string
): Promise<EvaluationResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
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

    if (interviewError || !interview) {
      throw new Error('Interview not found')
    }

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

    if (questionsError) {
      throw new Error('Failed to fetch questions')
    }

    // Parse transcript to extract Q&A pairs
    const qaMapping = await extractQuestionAnswers(transcript, questions, interviewId)

    // Process screening questions
    for (const qa of qaMapping.filter((q: any) => q.type === 'screening')) {
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
        (interview.roles as any).jd_text,
        interviewId
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
      const weight = qa.competency?.weight || 2
      const score = evaluation.score || 1

      totalWeightedScore += score * weight
      totalMaxScore += 4 * weight

      // Generate a one-line justification from strengths/concerns
      const topStrength = evaluation.strengths?.[0] || ''
      const topConcern = evaluation.concerns?.[0] || ''
      let justification = ''
      if (score >= 3 && topStrength) {
        justification = topStrength
      } else if (score <= 2 && topConcern) {
        justification = topConcern
      } else if (topStrength) {
        justification = topStrength
      } else if (topConcern) {
        justification = topConcern
      }

      competencyScores.push({
        competency_name: qa.competency?.name || 'Unknown',
        raw_score: score,
        weight: weight,
        weight_label: weight === 3 ? 'critical' : weight === 2 ? 'important' : 'nice_to_have',
        weighted_contribution: score * weight,
        max_contribution: 4 * weight,
        justification: justification,
        evidence_quotes: evaluation.evidence_quotes || [],
        strengths: evaluation.strengths || [],
        concerns: evaluation.concerns || []
      })
    })

    const overallScore = Math.round((totalWeightedScore / totalMaxScore) * 100)

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
    let whyThisCandidate: string[] | null = null
    let flagsRisks: string[] | null = null
    let keyConcerns: string[] | null = null
    let notableStrengths: string[] | null = null
    let considerationsFor: string[] | null = null
    let considerationsAgainst: string[] | null = null
    let reviewFocus: string | null = null

    if (recommendation === 'strong yes' || recommendation === 'yes') {
      whyThisCandidate = allStrengths.slice(0, 5)
      flagsRisks = allConcerns.slice(0, 5)
    } else if (recommendation === 'borderline') {
      considerationsFor = allStrengths.slice(0, 4)
      considerationsAgainst = allConcerns.slice(0, 4)
      const lowestScoring = [...competencyScores].sort((a, b) => a.raw_score - b.raw_score)[0]
      reviewFocus = `Listen to responses about ${lowestScoring?.competency_name || 'key competencies'} - this is where signals were mixed. Consider whether the candidate's delivery suggests more depth than the transcript captured.`
    } else {
      keyConcerns = allConcerns.slice(0, 5)
      notableStrengths = allStrengths.slice(0, 5)
    }

    // Extract competencies that were evaluated
    const evaluatedCompetencies = questions
      .filter((q: any) => q.type === 'interview' && q.competencies)
      .map((q: any) => q.competencies.name)
      .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index)
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

    let recommendationRationale: string
    try {
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

      recommendationRationale = rationaleCompletion.choices[0].message.content?.trim() ||
        `Based on the evaluation, we recommend "${recommendation}" for this candidate.`
    } catch (rationaleError: any) {
      console.error('Failed to generate rationale:', rationaleError)
      recommendationRationale = `Based on the evaluation, we recommend "${recommendation}" for this candidate.`
    }

    // Build question evaluations for UI
    const questionEvaluations = qaMapping
      .filter((qa: any) => qa.type === 'interview')
      .map((qa: any, index: number) => {
        const evaluationData = evaluations[index]
        const wordCount = qa.answer.split(' ').length
        const durationSeconds = Math.round(wordCount / 2)

        let evaluationSummary = 'No evaluation available'
        if (evaluationData) {
          const score = evaluationData.score || 0
          const hasStrengths = evaluationData.strengths?.length > 0
          const hasConcerns = evaluationData.concerns?.length > 0

          if (hasStrengths) {
            evaluationSummary = evaluationData.strengths.join('. ')
          } else if (hasConcerns) {
            const scoreLabel = score <= 1 ? 'Below expectations' : score === 2 ? 'Partially meets expectations' : 'Meets expectations'
            evaluationSummary = `${scoreLabel}: ${evaluationData.concerns[0]}`
          } else if (score) {
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
      why_this_candidate: whyThisCandidate,
      flags_risks: flagsRisks,
      key_concerns: keyConcerns,
      notable_strengths: notableStrengths,
      considerations_for: considerationsFor,
      considerations_against: considerationsAgainst,
      review_focus: reviewFocus,
      borderline_triggers: borderlineTriggers.length > 0 ? borderlineTriggers : null,
      competency_scores: competencyScores,
      question_evaluations: questionEvaluations
    }

    // Update interview with overall results AND evaluation status
    console.log('Updating interview with structured evaluation...')
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        score: overallScore,
        recommendation,
        structured_evaluation: structuredEvaluation,
        status: 'completed',
        evaluation_status: 'completed',
        evaluation_completed_at: new Date().toISOString(),
        evaluation_error: null
      })
      .eq('id', interviewId)

    if (updateError) {
      console.error('Error updating interview with structured evaluation:', updateError)
      throw new Error(`Failed to save evaluation results: ${updateError.message}`)
    }

    console.log('Successfully saved structured evaluation to interview')

    return {
      success: true,
      recommendation,
      score: overallScore
    }

  } catch (error: any) {
    console.error('Evaluation error:', error)

    // Log error to error_logs table
    await logError({
      endpoint: '/api/interview/evaluate',
      errorType: 'evaluation_error',
      errorMessage: error.message || 'Unknown evaluation error',
      errorStack: error.stack,
      interviewId
    })

    // Update interview with failure status
    try {
      await supabase
        .from('interviews')
        .update({
          evaluation_status: 'failed',
          evaluation_error: error.message || 'Unknown error'
        })
        .eq('id', interviewId)
    } catch (updateErr) {
      console.error('Failed to update interview with error status:', updateErr)
    }

    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Extract question-answer pairs from transcript using AI
 */
async function extractQuestionAnswers(transcript: string, questions: any[], interviewId?: string) {
  let completion
  try {
    completion = await openai.chat.completions.create({
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
  } catch (openaiError: any) {
    console.error('OpenAI API error in extractQuestionAnswers:', openaiError)
    await logError({
      endpoint: '/api/interview/evaluate',
      errorType: 'openai_error',
      errorMessage: `OpenAI extractQuestionAnswers failed: ${openaiError.message}`,
      errorStack: openaiError.stack,
      interviewId
    })
    throw new Error(`Failed to extract answers from transcript: ${openaiError.message}`)
  }

  const rawContent = completion.choices[0].message.content || '{}'

  let result
  try {
    result = JSON.parse(rawContent)
  } catch (parseError) {
    console.error('Failed to parse extractQuestionAnswers response:', rawContent.slice(0, 500))
    await logError({
      endpoint: '/api/interview/evaluate',
      errorType: 'json_parse_error',
      errorMessage: 'Failed to parse OpenAI response in extractQuestionAnswers',
      interviewId,
      requestBody: { rawContent: rawContent.slice(0, 1000) }
    })
    throw new Error('AI returned invalid JSON when extracting question answers')
  }

  // Validate response structure
  if (!result.qa_pairs || !Array.isArray(result.qa_pairs)) {
    console.error('Invalid qa_pairs structure:', result)
    await logError({
      endpoint: '/api/interview/evaluate',
      errorType: 'validation_error',
      errorMessage: 'OpenAI response missing qa_pairs array',
      interviewId,
      requestBody: { result }
    })
    throw new Error('AI response missing required qa_pairs array')
  }

  return result.qa_pairs.map((pair: any) => {
    // Validate question_index exists and is valid
    const questionIndex = pair.question_index
    if (typeof questionIndex !== 'number' || questionIndex < 0 || questionIndex >= questions.length) {
      console.warn(`Invalid question_index ${questionIndex}, skipping`)
      return null
    }

    return {
      question_id: questions[questionIndex].id,
      question: questions[questionIndex].text,
      answer: pair.answer || '',
      type: questions[questionIndex].type,
      competency: questions[questionIndex].competencies
    }
  }).filter(Boolean)
}

/**
 * Generate a summary for screening question answers
 */
async function generateScreeningSummary(question: string, answer: string): Promise<string> {
  try {
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
  } catch (error) {
    console.error('Failed to generate screening summary:', error)
    return '' // Return empty string on failure, don't crash
  }
}

/**
 * Evaluate an answer against the BARS rubric
 */
async function evaluateAgainstBars(
  question: string,
  answer: string,
  competency: any,
  jobDescription: string,
  interviewId?: string
) {
  // Default evaluation for fallback
  const defaultEvaluation = {
    score: 2,
    strengths: [],
    concerns: ['Evaluation could not be completed due to a technical error'],
    evidence_quotes: [],
    why_not_higher_score: 'Technical error during evaluation'
  }

  let completion
  try {
    completion = await openai.chat.completions.create({
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
  } catch (openaiError: any) {
    console.error('OpenAI API error in evaluateAgainstBars:', openaiError)
    await logError({
      endpoint: '/api/interview/evaluate',
      errorType: 'openai_error',
      errorMessage: `OpenAI evaluateAgainstBars failed: ${openaiError.message}`,
      interviewId,
      requestBody: { competency: competency.name, question: question.slice(0, 100) }
    })
    // Return default evaluation instead of crashing
    return defaultEvaluation
  }

  const rawContent = completion.choices[0].message.content || '{}'

  let result
  try {
    result = JSON.parse(rawContent)
  } catch (parseError) {
    console.error('Failed to parse evaluateAgainstBars response:', rawContent.slice(0, 500))
    await logError({
      endpoint: '/api/interview/evaluate',
      errorType: 'json_parse_error',
      errorMessage: 'Failed to parse OpenAI response in evaluateAgainstBars',
      interviewId,
      requestBody: { competency: competency.name, rawContent: rawContent.slice(0, 500) }
    })
    // Return default evaluation instead of crashing
    return defaultEvaluation
  }

  // Validate and sanitize score
  let score = result.score
  if (typeof score !== 'number' || score < 1 || score > 4) {
    console.warn(`Invalid score ${score}, defaulting to 2`)
    score = 2
  }

  return {
    score,
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    concerns: Array.isArray(result.concerns) ? result.concerns : [],
    evidence_quotes: Array.isArray(result.evidence_quotes) ? result.evidence_quotes : [],
    why_not_higher_score: result.why_not_higher_score || ''
  }
}
