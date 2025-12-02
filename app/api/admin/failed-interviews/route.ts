import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'
import { requireAdmin } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  // Require admin authentication
  const authResult = await requireAdmin()
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    // Query interviews with failed or pending_retry evaluation status
    const { data: failedByStatus, error: statusError } = await supabase
      .from('interviews')
      .select(`
        id,
        slug,
        status,
        evaluation_status,
        evaluation_error,
        completed_at,
        created_at,
        candidate:candidates(id, name, email),
        role:roles(id, title)
      `)
      .in('evaluation_status', ['failed', 'pending_retry'])
      .order('completed_at', { ascending: false })

    if (statusError) {
      throw new Error(`Failed to query failed interviews: ${statusError.message}`)
    }

    // Query completed interviews missing evaluation (edge case)
    const { data: missingEvaluation, error: missingError } = await supabase
      .from('interviews')
      .select(`
        id,
        slug,
        status,
        evaluation_status,
        evaluation_error,
        completed_at,
        created_at,
        candidate:candidates(id, name, email),
        role:roles(id, title)
      `)
      .eq('status', 'completed')
      .is('structured_evaluation', null)
      .not('evaluation_status', 'in', '("in_progress","completed")')
      .order('completed_at', { ascending: false })

    if (missingError) {
      throw new Error(`Failed to query missing evaluations: ${missingError.message}`)
    }

    // Combine and deduplicate by id
    const allFailed = [...(failedByStatus || []), ...(missingEvaluation || [])]
    const uniqueFailed = allFailed.filter((interview, index, self) =>
      index === self.findIndex(i => i.id === interview.id)
    )

    // Query recent unresolved errors
    const { data: unresolvedErrors, error: errorsError } = await supabase
      .from('error_logs')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (errorsError) {
      throw new Error(`Failed to query error logs: ${errorsError.message}`)
    }

    return NextResponse.json({
      failedInterviews: uniqueFailed,
      unresolvedErrors: unresolvedErrors || [],
      summary: {
        totalFailed: uniqueFailed.length,
        totalUnresolvedErrors: (unresolvedErrors || []).length
      }
    })
  } catch (error: any) {
    console.error('Failed interviews query error:', error)

    await logError({
      endpoint: '/api/admin/failed-interviews',
      errorType: 'admin_query_error',
      errorMessage: error.message || 'Failed to query failed interviews'
    })

    return NextResponse.json(
      { error: error.message || 'Failed to fetch failed interviews' },
      { status: 500 }
    )
  }
}
