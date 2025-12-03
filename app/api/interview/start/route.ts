import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'

export async function POST(request: Request) {
  let slug: string | undefined

  try {
    const body = await request.json()
    slug = body.slug

    // Validate required fields
    if (!slug) {
      return NextResponse.json(
        { error: 'Interview slug is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Verify interview exists and is in correct state
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, status')
      .eq('slug', slug)
      .single()

    if (fetchError || !interview) {
      await logError({
        endpoint: '/api/interview/start',
        errorType: 'interview_not_found',
        errorMessage: `Interview not found for slug: ${slug}`,
        interviewSlug: slug
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Verify interview is in correct state to start
    if (interview.status !== 'invited') {
      return NextResponse.json(
        { error: `Interview cannot be started - current status: ${interview.status}` },
        { status: 400 }
      )
    }

    // Update interview status to in_progress
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('slug', slug)

    if (updateError) {
      await logError({
        endpoint: '/api/interview/start',
        errorType: 'interview_update_failed',
        errorMessage: updateError.message,
        interviewSlug: slug,
        interviewId: interview.id
      })
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Interview start error:', error)

    await logError({
      endpoint: '/api/interview/start',
      errorType: 'start_exception',
      errorMessage: error.message || 'Failed to start interview',
      errorStack: error.stack,
      interviewSlug: slug
    })

    return NextResponse.json(
      { error: error.message || 'Failed to start interview' },
      { status: 500 }
    )
  }
}
