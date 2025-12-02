import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface HealthCheck {
  status: 'ok' | 'degraded' | 'down'
  latency?: number
  error?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: HealthCheck
  }
  version?: string
}

export async function GET() {
  const startTime = Date.now()
  const checks: HealthResponse['checks'] = {
    database: { status: 'down' }
  }

  // Check database connectivity
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const dbStart = Date.now()
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    const dbLatency = Date.now() - dbStart

    if (error) {
      checks.database = {
        status: 'down',
        error: error.message,
        latency: dbLatency
      }
    } else {
      checks.database = {
        status: dbLatency < 1000 ? 'ok' : 'degraded',
        latency: dbLatency
      }
    }
  } catch (error: any) {
    checks.database = {
      status: 'down',
      error: error.message
    }
  }

  // Determine overall status
  const allChecks = Object.values(checks)
  const hasDown = allChecks.some(c => c.status === 'down')
  const hasDegraded = allChecks.some(c => c.status === 'degraded')

  let overallStatus: HealthResponse['status'] = 'healthy'
  if (hasDown) {
    overallStatus = 'unhealthy'
  } else if (hasDegraded) {
    overallStatus = 'degraded'
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || '1.0.0'
  }

  return NextResponse.json(response, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}
