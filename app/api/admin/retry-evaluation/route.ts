import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: Request) {
  let interviewId: string | undefined

  try {
    const body = await request.json()
    interviewId = body.interviewId

    if (!interviewId) {
      return NextResponse.json(
        { error: 'interviewId is required' },
        { status: 400 }
      )
    }

    // Fetch interview with transcript
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, slug, transcript, evaluation_status')
      .eq('id', interviewId)
      .single()

    if (fetchError || !interview) {
      await logError({
        endpoint: '/api/admin/retry-evaluation',
        errorType: 'interview_not_found',
        errorMessage: fetchError?.message || `Interview not found: ${interviewId}`,
        interviewId
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Validate transcript exists
    const transcript = interview.transcript?.text || interview.transcript
    if (!transcript || transcript.length === 0) {
      await logError({
        endpoint: '/api/admin/retry-evaluation',
        errorType: 'no_transcript',
        errorMessage: 'Cannot retry evaluation - no transcript available',
        interviewId,
        interviewSlug: interview.slug
      })
      return NextResponse.json(
        { error: 'No transcript available for this interview' },
        { status: 400 }
      )
    }

    // Set evaluation_status to in_progress
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        evaluation_status: 'in_progress',
        evaluation_error: null
      })
      .eq('id', interviewId)

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`)
    }

    console.log(`🔄 Retrying evaluation for interview ${interview.slug}`)

    // Call evaluate endpoint
    const evaluationResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/interview/evaluate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          transcript: typeof transcript === 'string' ? transcript : transcript.text || JSON.stringify(transcript)
        })
      }
    )

    if (!evaluationResponse.ok) {
      const errorText = await evaluationResponse.text()
      console.error('❌ Retry evaluation failed:', errorText)

      // Update status to failed
      await supabase
        .from('interviews')
        .update({
          evaluation_status: 'failed',
          evaluation_error: `Retry failed (${evaluationResponse.status}): ${errorText.slice(0, 500)}`
        })
        .eq('id', interviewId)

      await logError({
        endpoint: '/api/admin/retry-evaluation',
        errorType: 'retry_failed',
        errorMessage: `Evaluation returned ${evaluationResponse.status}: ${errorText.slice(0, 500)}`,
        interviewId,
        interviewSlug: interview.slug
      })

      return NextResponse.json(
        { error: 'Evaluation retry failed', details: errorText.slice(0, 500) },
        { status: 500 }
      )
    }

    const result = await evaluationResponse.json()
    console.log(`✅ Retry evaluation succeeded for ${interview.slug}`)

    // Update status to completed
    await supabase
      .from('interviews')
      .update({
        evaluation_status: 'completed',
        evaluation_completed_at: new Date().toISOString(),
        evaluation_error: null
      })
      .eq('id', interviewId)

    return NextResponse.json({
      success: true,
      message: 'Evaluation retry completed successfully',
      interviewSlug: interview.slug,
      result
    })
  } catch (error: any) {
    console.error('Retry evaluation error:', error)

    // Update status to failed
    if (interviewId) {
      await supabase
        .from('interviews')
        .update({
          evaluation_status: 'failed',
          evaluation_error: error.message
        })
        .eq('id', interviewId)
    }

    await logError({
      endpoint: '/api/admin/retry-evaluation',
      errorType: 'retry_exception',
      errorMessage: error.message || 'Retry evaluation failed',
      errorStack: error.stack,
      interviewId
    })

    return NextResponse.json(
      { error: error.message || 'Retry evaluation failed' },
      { status: 500 }
    )
  }
}
