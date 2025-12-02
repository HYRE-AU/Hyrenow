import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'
import { requireAdmin } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: Request) {
  // Require admin authentication
  const authResult = await requireAdmin()
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const body = await request.json()
    const { errorId, notes } = body

    if (!errorId) {
      return NextResponse.json(
        { error: 'errorId is required' },
        { status: 400 }
      )
    }

    // Update error log with resolution
    const { data, error: updateError } = await supabase
      .from('error_logs')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: notes || 'Marked as resolved'
      })
      .eq('id', errorId)
      .select()
      .single()

    if (updateError) {
      await logError({
        endpoint: '/api/admin/resolve-error',
        errorType: 'resolve_failed',
        errorMessage: updateError.message,
        requestBody: { errorId }
      })
      return NextResponse.json(
        { error: `Failed to resolve error: ${updateError.message}` },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Error log not found' },
        { status: 404 }
      )
    }

    console.log(`✅ Error ${errorId} marked as resolved`)

    return NextResponse.json({
      success: true,
      message: 'Error marked as resolved',
      error: data
    })
  } catch (error: any) {
    console.error('Resolve error failed:', error)

    await logError({
      endpoint: '/api/admin/resolve-error',
      errorType: 'resolve_exception',
      errorMessage: error.message || 'Failed to resolve error',
      errorStack: error.stack
    })

    return NextResponse.json(
      { error: error.message || 'Failed to resolve error' },
      { status: 500 }
    )
  }
}
