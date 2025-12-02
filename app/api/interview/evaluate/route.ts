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

    // Calculate overall recommendation
    const avgScore = evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
    const recommendation =
      avgScore >= 3.5 ? 'strong yes' :
      avgScore >= 2.5 ? 'yes' :
      avgScore >= 1.5 ? 'no' : 'strong no'

    const overallScore = Math.round((avgScore / 4) * 100)

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

    // Organize based on recommendation
    let reasonsToProceed: string[] | null = null
    let flagsRisks: string[] | null = null
    let reasonsNotToProceed: string[] | null = null
    let strengths: string[] | null = null

    if (recommendation === 'strong yes' || recommendation === 'yes') {
      reasonsToProceed = allStrengths.slice(0, 5)
      flagsRisks = allConcerns.slice(0, 5)
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

    // Generate recommendation rationale using LLM - rooted in competencies and responsibilities
    const rationalePrompt = `Based on this interview evaluation, write a 2-3 sentence explanation of WHY we recommend "${recommendation}" for this candidate.

Role: ${(interview.roles as any).title}

Competencies Evaluated: ${evaluatedCompetencies}

Job Responsibilities/What They'll Do:
${(interview.roles as any).jd_text}

Average Score: ${avgScore.toFixed(2)}/4.0
Key Strengths: ${allStrengths.slice(0, 3).join('; ') || 'None identified'}
Key Concerns: ${allConcerns.slice(0, 3).join('; ') || 'None identified'}

Write a concise, specific rationale that:
1. Connects their performance in the evaluated competencies to the actual job responsibilities
2. Explains whether they can handle what they'll be doing day-to-day in this role
3. Focuses on the most important factors for success in this specific position

Be specific about how their strengths/concerns relate to the responsibilities they'll have.`

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
      recommendation_rationale: recommendationRationale,
      reasons_to_proceed: reasonsToProceed,
      flags_risks: flagsRisks,
      reasons_not_to_proceed: reasonsNotToProceed,
      strengths: strengths,
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