/**
 * HYRE Security Test: Error Handling & Logging
 *
 * Tests that errors are properly logged to the database and Slack.
 *
 * Run: npx ts-node scripts/security-tests/error-handling-test.ts
 */

import { createClient } from '@supabase/supabase-js'

// Load env
require('dotenv').config({ path: '.env.local' })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface TestResult {
  test: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function log(test: string, passed: boolean, details: string) {
  results.push({ test, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${test}`)
  if (!passed) {
    console.log(`   Details: ${details}`)
  }
}

async function getRecentErrors(since: Date): Promise<any[]> {
  const { data } = await supabase
    .from('error_logs')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  return data || []
}

async function triggerError(endpoint: string, method: 'GET' | 'POST', body?: object): Promise<number> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options)
    return response.status
  } catch (error) {
    return 0
  }
}

async function runErrorHandlingTests() {
  console.log('\n🔒 HYRE Security Test: Error Handling & Logging\n')
  console.log('=' .repeat(60))
  console.log(`Testing against: ${BASE_URL}`)
  console.log('=' .repeat(60))

  const testStartTime = new Date()

  // Test 1: Trigger test alert endpoint
  console.log('\n📋 Test 1: Test Alert Endpoint\n')

  // Note: This will fail without auth, but we're testing the error logging
  const alertStatus = await triggerError('/api/admin/test-alert', 'GET')
  console.log(`   /api/admin/test-alert returned status: ${alertStatus}`)

  // Test 2: Trigger validation errors
  console.log('\n📋 Test 2: Validation Errors\n')

  // Missing interview slug
  const startStatus = await triggerError('/api/interview/start', 'POST', {})
  console.log(`   /api/interview/start (missing slug) returned status: ${startStatus}`)

  // Invalid interview ID
  const proceedStatus = await triggerError('/api/interview/proceed', 'POST', {
    interviewId: 'invalid-uuid-format'
  })
  console.log(`   /api/interview/proceed (invalid ID) returned status: ${proceedStatus}`)

  // Test 3: Trigger not found errors
  console.log('\n📋 Test 3: Not Found Errors\n')

  const notFoundStatus = await triggerError('/api/interview/nonexistent-slug-12345', 'GET')
  console.log(`   /api/interview/nonexistent-slug returned status: ${notFoundStatus}`)

  // Test 4: Check if errors were logged
  console.log('\n📋 Test 4: Checking Error Logs\n')

  // Wait a moment for logs to be written
  await new Promise(resolve => setTimeout(resolve, 2000))

  const recentErrors = await getRecentErrors(testStartTime)

  if (recentErrors.length > 0) {
    log(
      'Errors logged to database',
      true,
      `${recentErrors.length} errors logged since test started`
    )

    console.log('\n   Recent error types:')
    const errorTypes = [...new Set(recentErrors.map(e => e.error_type))]
    errorTypes.forEach(type => {
      const count = recentErrors.filter(e => e.error_type === type).length
      console.log(`   - ${type}: ${count}`)
    })
  } else {
    log(
      'Errors logged to database',
      false,
      'No errors found in error_logs table - logging may not be working'
    )
  }

  // Test 5: Check error log structure
  console.log('\n📋 Test 5: Error Log Structure\n')

  if (recentErrors.length > 0) {
    const sampleError = recentErrors[0]
    const hasEndpoint = !!sampleError.endpoint
    const hasErrorType = !!sampleError.error_type
    const hasErrorMessage = !!sampleError.error_message
    const hasCreatedAt = !!sampleError.created_at

    log(
      'Error log has endpoint',
      hasEndpoint,
      hasEndpoint ? sampleError.endpoint : 'Missing endpoint field'
    )
    log(
      'Error log has error_type',
      hasErrorType,
      hasErrorType ? sampleError.error_type : 'Missing error_type field'
    )
    log(
      'Error log has error_message',
      hasErrorMessage,
      hasErrorMessage ? 'Present' : 'Missing error_message field'
    )
    log(
      'Error log has created_at',
      hasCreatedAt,
      hasCreatedAt ? sampleError.created_at : 'Missing created_at field'
    )
  }

  // Test 6: Check Slack webhook configuration
  console.log('\n📋 Test 6: Slack Configuration\n')

  const hasSlackWebhook = !!process.env.SLACK_WEBHOOK_URL
  log(
    'SLACK_WEBHOOK_URL configured',
    hasSlackWebhook,
    hasSlackWebhook ? 'Configured' : 'Not configured - Slack alerts disabled'
  )

  // Test 7: Check routes that should log errors but don't
  console.log('\n📋 Test 7: Routes Missing Error Logging\n')

  const routesMissingLogging = [
    '/api/interview/start',
    '/api/interview/knockout',
    '/api/interview/feedback',
    '/api/interview/proceed',
    '/api/interview/reject',
    '/api/roles/add',
    '/api/roles/generate-competencies',
    '/api/roles/generate-interview-questions',
    '/api/auth/signup',
    '/api/candidates/invite',
    '/api/roles/parse-job-url',
  ]

  console.log('   Routes that need logError() calls added:')
  routesMissingLogging.forEach(route => {
    console.log(`   ⚠️  ${route}`)
  })

  log(
    'All routes have error logging',
    false,
    `${routesMissingLogging.length} routes missing logError() calls`
  )

  // Summary
  console.log('\n' + '=' .repeat(60))
  console.log('📊 SUMMARY')
  console.log('=' .repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`\nTotal Tests: ${results.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n⚠️  ERROR HANDLING ISSUES:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.test}: ${r.details}`)
    })

    console.log('\n🔧 RECOMMENDED FIXES:')
    console.log('   1. Add logError() calls to all routes listed above')
    console.log('   2. Configure SLACK_WEBHOOK_URL for production alerts')
    console.log('   3. Ensure all catch blocks include error logging')
  }

  console.log('\n')
}

runErrorHandlingTests().catch(console.error)
