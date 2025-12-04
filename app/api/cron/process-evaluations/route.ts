/**
 * Cron Job: Process Pending Evaluations
 *
 * This endpoint is called by Vercel Cron every minute to process
 * pending interview evaluations. This avoids timeout issues by
 * processing evaluations asynchronously.
 *
 * Security: Requires CRON_SECRET header for authorization
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processEvaluation } from '@/lib/evaluationService'

// Vercel Cron config - allow up to 5 minutes for processing
export const maxDuration = 300

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    // Find ONE pending evaluation (oldest first)
    const { data: pendingInterview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, transcript')
      .eq('evaluation_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (fetchError) {
      // No pending evaluations - this is normal
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          message: 'No pending evaluations'
        })
      }
      throw fetchError
    }

    if (!pendingInterview) {
      return NextResponse.json({
        success: true,
        message: 'No pending evaluations'
      })
    }

    console.log(`Processing evaluation for interview: ${pendingInterview.id}`)

    // Mark as processing to prevent duplicate processing
    const { error: updateError } = await supabase
      .from('interviews')
      .update({ evaluation_status: 'processing' })
      .eq('id', pendingInterview.id)
      .eq('evaluation_status', 'pending') // Optimistic lock

    if (updateError) {
      console.error('Failed to mark interview as processing:', updateError)
      throw updateError
    }

    // Process the evaluation
    const result = await processEvaluation(
      pendingInterview.id,
      pendingInterview.transcript
    )

    if (result.success) {
      console.log(`Evaluation completed: ${result.recommendation} (${result.score}%)`)
      return NextResponse.json({
        success: true,
        interviewId: pendingInterview.id,
        recommendation: result.recommendation,
        score: result.score
      })
    } else {
      console.error(`Evaluation failed: ${result.error}`)
      return NextResponse.json({
        success: false,
        interviewId: pendingInterview.id,
        error: result.error
      })
    }

  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
