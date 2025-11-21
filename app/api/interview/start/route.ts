import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { slug } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Update interview status to in_progress
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('slug', slug)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Interview start error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
