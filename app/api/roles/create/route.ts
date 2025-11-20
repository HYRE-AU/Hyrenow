import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { title, jdText, questions } = await request.json()

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

    // Create the role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        org_id: profile.org_id,
        created_by: user.id,
        title,
        jd_text: jdText,
        status: 'active',
      })
      .select()
      .single()

    if (roleError) throw roleError

    // Create the questions
    const questionInserts = questions.map((q: string, index: number) => ({
      role_id: role.id,
      text: q,
      order_index: index,
      source: 'generated',
    }))

    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionInserts)

    if (questionsError) throw questionsError

    return NextResponse.json({ roleId: role.id })
  } catch (error: any) {
    console.error('Role creation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}