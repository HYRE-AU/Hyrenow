import { NextResponse } from 'next/server'
import { logError } from '@/lib/errorLogger'

export async function GET() {
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
