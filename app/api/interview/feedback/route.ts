import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'

export async function POST(request: Request) {
  let interviewId: string | undefined

  try {
    const body = await request.json()
    interviewId = body.interviewId
    const { rating, feedbackText } = body

    // Validate required fields
    if (!interviewId) {
      return NextResponse.json(
        { error: 'Interview ID is required' },
        { status: 400 }
      )
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Verify interview exists
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, status')
      .eq('id', interviewId)
      .single()

    if (fetchError || !interview) {
      await logError({
        endpoint: '/api/interview/feedback',
        errorType: 'interview_not_found',
        errorMessage: `Interview not found: ${interviewId}`,
        interviewId
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('interview_feedback')
      .insert({
        interview_id: interviewId,
        rating,
        feedback_text: feedbackText || null
      })

    if (error) {
      await logError({
        endpoint: '/api/interview/feedback',
        errorType: 'feedback_insert_failed',
        errorMessage: error.message,
        interviewId
      })
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Feedback error:', error)

    await logError({
      endpoint: '/api/interview/feedback',
      errorType: 'feedback_exception',
      errorMessage: error.message || 'Failed to submit feedback',
      errorStack: error.stack,
      interviewId
    })

    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}