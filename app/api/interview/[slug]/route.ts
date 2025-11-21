import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: interview, error } = await supabase
      .from('interviews')
      .select(`
        id,
        status,
        slug,
        roles (
          id,
          title,
          jd_text,
          organisations (
            name
          )
        ),
        candidates (
          name,
          email
        )
      `)
      .eq('slug', slug)
      .single()

    if (error || !interview) throw error

    // Fetch questions for this role
    const roleId = (interview as any).roles?.id
    const { data: questions } = await supabase
      .from('questions')
      .select('text, order_index')
      .eq('role_id', roleId)
      .order('order_index')

    return NextResponse.json({
      ...interview,
      questions
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Interview not found' },
      { status: 404 }
    )
  }
}