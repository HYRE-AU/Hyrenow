/**
 * HYRE Security Test: Authentication & Authorization
 *
 * Tests that protected endpoints return 401 without authentication
 * and that admin endpoints are properly protected.
 *
 * Run: npx ts-node scripts/security-tests/auth-test.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface TestResult {
  endpoint: string
  method: string
  expected: number
  actual: number
  passed: boolean
  error?: string
}

const results: TestResult[] = []

async function testEndpoint(
  endpoint: string,
  method: 'GET' | 'POST',
  expectedStatus: number,
  body?: object
): Promise<void> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options)
    const passed = response.status === expectedStatus

    results.push({
      endpoint,
      method,
      expected: expectedStatus,
      actual: response.status,
      passed,
    })

    const icon = passed ? '✅' : '❌'
    console.log(`${icon} ${method} ${endpoint} - Expected: ${expectedStatus}, Got: ${response.status}`)
  } catch (error: any) {
    results.push({
      endpoint,
      method,
      expected: expectedStatus,
      actual: 0,
      passed: false,
      error: error.message,
    })
    console.log(`❌ ${method} ${endpoint} - Error: ${error.message}`)
  }
}

async function runAuthTests() {
  console.log('\n🔒 HYRE Security Test: Authentication & Authorization\n')
  console.log('=' .repeat(60))
  console.log(`Testing against: ${BASE_URL}`)
  console.log('=' .repeat(60))

  // Admin endpoints - should return 401 without auth
  console.log('\n📋 Testing Admin Endpoints (expect 401 without auth):\n')

  await testEndpoint('/api/admin/failed-interviews', 'GET', 401)
  await testEndpoint('/api/admin/retry-evaluation', 'POST', 401, { interviewId: 'test' })
  await testEndpoint('/api/admin/resolve-error', 'POST', 401, { errorId: 'test' })
  await testEndpoint('/api/admin/test-alert', 'GET', 401)

  // Interview manipulation endpoints - SHOULD require auth but currently DON'T
  console.log('\n📋 Testing Interview Endpoints (currently NO auth - SECURITY ISSUE):\n')

  await testEndpoint('/api/interview/start', 'POST', 401, { slug: 'test-slug' })
  await testEndpoint('/api/interview/complete', 'POST', 401, { slug: 'test-slug' })
  await testEndpoint('/api/interview/proceed', 'POST', 401, { interviewId: 'test-id' })
  await testEndpoint('/api/interview/reject', 'POST', 401, { interviewId: 'test-id' })
  await testEndpoint('/api/interview/feedback', 'POST', 401, { interviewId: 'test-id', rating: 5 })
  await testEndpoint('/api/interview/knockout', 'POST', 401, { interviewId: 'test-id', responses: [] })
  await testEndpoint('/api/interview/evaluate', 'POST', 401, { interviewId: 'test-id', transcript: 'test' })

  // Protected role/candidate endpoints
  console.log('\n📋 Testing Role/Candidate Endpoints:\n')

  await testEndpoint('/api/roles/add', 'POST', 401, { title: 'Test' })
  await testEndpoint('/api/candidates/invite', 'POST', 401, { roleId: 'test', candidates: [] })

  // Public endpoints - should NOT return 401
  console.log('\n📋 Testing Public Endpoints (should be accessible):\n')

  await testEndpoint('/api/health', 'GET', 200)
  await testEndpoint('/api/roles/parse-job-url', 'POST', 400, { url: '' }) // 400 = validation error, not 401

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
    console.log('\n⚠️  FAILED TESTS (Security Issues):')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.method} ${r.endpoint}: Expected ${r.expected}, Got ${r.actual}`)
    })
  }

  console.log('\n')
}

runAuthTests().catch(console.error)
