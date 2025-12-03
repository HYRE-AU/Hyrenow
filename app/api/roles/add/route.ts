import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'

export async function POST(request: Request) {
  let roleTitle: string | undefined

  try {
    const { title, description, companyName, competencies, questions, knockoutQuestions, roleBriefing } = await request.json()
    roleTitle = title

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
        jd_text: description,
        company_name: companyName || null,
        role_briefing: roleBriefing || null,
        status: 'active',
      })
      .select()
      .single()

    if (roleError) throw roleError

    // Create competencies if provided
    let competencyMap = new Map<string, string>()
    if (competencies && competencies.length > 0) {
const competencyInserts = competencies.map((c: any) => ({
  role_id: role.id,
  name: c.name,
  description: c.description, 
  weight: c.weight || 2,
  bars_rubric: c.bars_rubric
}))

      const { data: createdCompetencies, error: competenciesError } = await supabase
        .from('competencies')
        .insert(competencyInserts)
        .select()

      if (competenciesError) throw competenciesError

      // Create competency name to ID map
      competencyMap = new Map(
        createdCompetencies.map(c => [c.name, c.id])
      )
    }

    // Create the questions
    const questionInserts = questions.map((q: any) => ({
      role_id: role.id,
      text: q.text,
      order_index: q.order,
      type: q.type,
      competency_id: q.type === 'interview' && q.competency_name
        ? competencyMap.get(q.competency_name)
        : null,
      source: 'generated',
    }))

    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionInserts)

    if (questionsError) throw questionsError

    // Create knockout questions if provided
    if (knockoutQuestions && knockoutQuestions.length > 0) {
      const knockoutInserts = knockoutQuestions.map((kq: any, index: number) => ({
        role_id: role.id,
        question_text: kq.question_text,
        required_answer: kq.required_answer,
        order_index: index
      }))

      const { error: knockoutError } = await supabase
        .from('knockout_questions')
        .insert(knockoutInserts)

      if (knockoutError) throw knockoutError
    }

    return NextResponse.json({ roleId: role.id })
  } catch (error: any) {
    console.error('Role creation error:', error)

    await logError({
      endpoint: '/api/roles/add',
      errorType: 'role_creation_exception',
      errorMessage: error.message || 'Failed to create role',
      errorStack: error.stack,
      requestBody: { roleTitle }
    })

    return NextResponse.json(
      { error: error.message || 'Failed to create role' },
      { status: 500 }
    )
  }
}