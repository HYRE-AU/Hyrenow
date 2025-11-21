import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { interviewId, rating, feedbackText } = await request.json()

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

    const { error } = await supabase
      .from('interview_feedback')
      .insert({
        interview_id: interviewId,
        rating,
        feedback_text: feedbackText || null
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}