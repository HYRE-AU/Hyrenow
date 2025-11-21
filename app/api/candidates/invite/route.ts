import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  try {
    const { roleId, candidates } = await request.json()

    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Use service role for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user's profile to get org_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Process each candidate
    const results = []

    for (const candidate of candidates) {
      try {
        // Create or get candidate
        let candidateId: string

        const { data: existingCandidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('email', candidate.email.toLowerCase().trim())
          .eq('org_id', profile.org_id)
          .single()

        if (existingCandidate) {
          candidateId = existingCandidate.id
        } else {
          const { data: newCandidate, error: candidateError } = await supabase
            .from('candidates')
            .insert({
              org_id: profile.org_id,
              name: `${candidate.firstName} ${candidate.lastName}`,
              email: candidate.email.toLowerCase().trim(),
            })
            .select()
            .single()

          if (candidateError) throw candidateError
          candidateId = newCandidate.id
        }

        // Generate unique slug for the interview
        const slug = nanoid(10)

        // Create interview
        const { error: interviewError } = await supabase
          .from('interviews')
          .insert({
            org_id: profile.org_id,
            role_id: roleId,
            candidate_id: candidateId,
            slug,
            status: 'invited',
          })

        if (interviewError) throw interviewError

        results.push({
          ...candidate,
          id: candidateId,
          slug,
          success: true
        })
      } catch (error: any) {
        results.push({
          ...candidate,
          error: error.message,
          success: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error: any) {
    console.error('Candidate invitation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}