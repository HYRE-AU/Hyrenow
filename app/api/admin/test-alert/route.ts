import { NextResponse } from 'next/server'
import { logError } from '@/lib/errorLogger'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  // Require admin authentication
  const authResult = await requireAdmin()
  if (!authResult.authorized) {
    return authResult.response
  }

  await logError({
    endpoint: '/api/admin/test-alert',
    errorType: 'test_alert',
    errorMessage: 'This is a test alert - if you see this in Slack, alerts are working!',
    interviewSlug: 'test-123'
  })

  return NextResponse.json({
    success: true,
    message: 'Test alert sent - check Slack and error_logs table'
  })
}
