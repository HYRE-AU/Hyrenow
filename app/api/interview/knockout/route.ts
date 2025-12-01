import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { interviewId, responses } = await request.json()
    // responses = [{ knockoutQuestionId, answer }]

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get the interview and knockout questions
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, role_id')
      .eq('id', interviewId)
      .single()

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Get knockout questions to validate answers
    const { data: knockoutQuestions } = await supabase
      .from('knockout_questions')
      .select('id, question_text, required_answer')
      .eq('role_id', interview.role_id)

    // Check if candidate passed all knockout questions
    let passed = true
    let failedReason = ''

    for (const kq of knockoutQuestions || []) {
      const response = responses.find((r: any) => r.knockoutQuestionId === kq.id)
      if (!response) {
        passed = false
        failedReason = 'Missing response'
        break
      }
      
      // Check if answer matches required answer
      if (response.answer !== kq.required_answer) {
        passed = false
        failedReason = kq.question_text
        break
      }
    }

    // Save responses
    const responseInserts = responses.map((r: any) => ({
      interview_id: interviewId,
      knockout_question_id: r.knockoutQuestionId,
      answer: r.answer
    }))

    await supabase
      .from('knockout_responses')
      .upsert(responseInserts, { onConflict: 'interview_id,knockout_question_id' })

    // If failed, update interview status
    if (!passed) {
      await supabase
        .from('interviews')
        .update({
          status: 'screened_out',
          screened_out_at: new Date().toISOString(),
          screened_out_reason: failedReason
        })
        .eq('id', interviewId)
    }

    return NextResponse.json({ 
      passed,
      failedReason: passed ? null : failedReason
    })

  } catch (error: any) {
    console.error('Knockout submission error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}