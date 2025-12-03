import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'
import { getAuthenticatedUserWithProfile } from '@/lib/auth'

export async function POST(request: Request) {
  let interviewId: string | undefined

  try {
    // Require authentication - this is a hiring manager action
    const userWithProfile = await getAuthenticatedUserWithProfile()
    if (!userWithProfile) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }

    const { profile } = userWithProfile
    const body = await request.json()
    interviewId = body.interviewId

    // Validate required fields
    if (!interviewId) {
      return NextResponse.json(
        { error: 'Interview ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Verify interview exists and belongs to user's organization
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, status, org_id')
      .eq('id', interviewId)
      .single()

    if (fetchError || !interview) {
      await logError({
        endpoint: '/api/interview/proceed',
        errorType: 'interview_not_found',
        errorMessage: `Interview not found: ${interviewId}`,
        interviewId
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Verify organization ownership
    if (interview.org_id !== profile.org_id) {
      await logError({
        endpoint: '/api/interview/proceed',
        errorType: 'unauthorized_access',
        errorMessage: `User org ${profile.org_id} attempted to access interview from org ${interview.org_id}`,
        interviewId
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Update interview status
    const { error } = await supabase
      .from('interviews')
      .update({
        status: 'progressed',
        progressed_at: new Date().toISOString()
      })
      .eq('id', interviewId)

    if (error) {
      await logError({
        endpoint: '/api/interview/proceed',
        errorType: 'interview_update_failed',
        errorMessage: error.message,
        interviewId
      })
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Interview proceed error:', error)

    await logError({
      endpoint: '/api/interview/proceed',
      errorType: 'proceed_exception',
      errorMessage: error.message || 'Failed to proceed interview',
      errorStack: error.stack,
      interviewId
    })

    return NextResponse.json(
      { error: error.message || 'Failed to proceed interview' },
      { status: 500 }
    )
  }
}