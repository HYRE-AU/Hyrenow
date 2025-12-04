/**
 * Manual Evaluation Endpoint
 *
 * This endpoint can be called manually to trigger or retry an evaluation.
 * It uses the shared evaluationService for the actual processing.
 *
 * The primary evaluation flow now uses the cron job, but this endpoint
 * remains for:
 * - Manual retries via admin interface
 * - Testing and development
 * - Backwards compatibility
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processEvaluation } from '@/lib/evaluationService'

// Allow up to 5 minutes for evaluation
export const maxDuration = 300

export async function POST(request: Request) {
  let interviewId: string | undefined

  try {
    const body = await request.json()
    interviewId = body.interviewId
    const transcript = body.transcript

    if (!interviewId) {
      return NextResponse.json(
        { error: 'interviewId is required' },
        { status: 400 }
      )
    }

    // If transcript not provided in request, fetch from database
    let transcriptToUse = transcript
    if (!transcriptToUse) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )

      const { data: interview, error } = await supabase
        .from('interviews')
        .select('transcript')
        .eq('id', interviewId)
        .single()

      if (error || !interview) {
        return NextResponse.json(
          { error: 'Interview not found' },
          { status: 404 }
        )
      }

      transcriptToUse = interview.transcript
    }

    if (!transcriptToUse) {
      return NextResponse.json(
        { error: 'No transcript available for evaluation' },
        { status: 400 }
      )
    }

    // Mark as processing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    await supabase
      .from('interviews')
      .update({ evaluation_status: 'processing' })
      .eq('id', interviewId)

    // Process the evaluation using the shared service
    const result = await processEvaluation(interviewId, transcriptToUse)

    if (result.success) {
      return NextResponse.json({
        success: true,
        recommendation: result.recommendation,
        score: result.score
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Evaluation error:', error)

    // Update interview with failure status
    if (interviewId) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY!
        )
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
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
