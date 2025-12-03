/**
 * HYRE Security Test: Multi-Tenancy & Data Isolation
 *
 * Tests that organizations cannot access each other's data.
 * This requires two test organizations in the database.
 *
 * Run: npx ts-node scripts/security-tests/data-isolation-test.ts
 */

import { createClient } from '@supabase/supabase-js'

// Load env
require('dotenv').config({ path: '.env.local' })

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

async function runDataIsolationTests() {
  console.log('\n🔒 HYRE Security Test: Multi-Tenancy & Data Isolation\n')
  console.log('=' .repeat(60))

  // Get two different organizations
  const { data: orgs, error: orgsError } = await supabase
    .from('organisations')
    .select('id, name')
    .limit(2)

  if (orgsError || !orgs || orgs.length < 2) {
    console.log('❌ Need at least 2 organizations in database to run isolation tests')
    console.log('   Create test organizations first.')
    return
  }

  const orgA = orgs[0]
  const orgB = orgs[1]

  console.log(`Organization A: ${orgA.name} (${orgA.id})`)
  console.log(`Organization B: ${orgB.name} (${orgB.id})`)
  console.log('=' .repeat(60))

  // Test 1: Check if interviews are isolated
  console.log('\n📋 Testing Interview Isolation:\n')

  const { data: interviewsA } = await supabase
    .from('interviews')
    .select('id, slug')
    .eq('org_id', orgA.id)
    .limit(1)

  if (interviewsA && interviewsA.length > 0) {
    const interviewSlug = interviewsA[0].slug

    // Try to access OrgA's interview without org_id filter (simulating the vulnerability)
    const { data: accessedInterview } = await supabase
      .from('interviews')
      .select('id, org_id')
      .eq('slug', interviewSlug)
      .single()

    if (accessedInterview) {
      log(
        'Interview slug access',
        false,
        `Interview ${interviewSlug} accessible without org_id check - org_id: ${accessedInterview.org_id}`
      )
    } else {
      log('Interview slug access', true, 'Interview not accessible without proper filtering')
    }
  } else {
    console.log('   ⚠️  No interviews in OrgA to test')
  }

  // Test 2: Check if candidates are isolated
  console.log('\n📋 Testing Candidate Isolation:\n')

  const { data: candidatesA } = await supabase
    .from('candidates')
    .select('id, name, org_id')
    .eq('org_id', orgA.id)
    .limit(1)

  const { data: candidatesB } = await supabase
    .from('candidates')
    .select('id, name, org_id')
    .eq('org_id', orgB.id)
    .limit(1)

  if (candidatesA && candidatesA.length > 0 && candidatesB && candidatesB.length > 0) {
    // Check if OrgB can see OrgA's candidates (simulating missing RLS)
    const { data: crossOrgCandidates } = await supabase
      .from('candidates')
      .select('id, name, org_id')

    const orgACandidateInResults = crossOrgCandidates?.find(c => c.org_id === orgA.id)
    const orgBCandidateInResults = crossOrgCandidates?.find(c => c.org_id === orgB.id)

    if (orgACandidateInResults && orgBCandidateInResults) {
      log(
        'Candidate cross-org access',
        false,
        `Service key can see candidates from multiple orgs - RLS not enforced`
      )
    }
  }

  // Test 3: Check if roles are isolated
  console.log('\n📋 Testing Role Isolation:\n')

  const { data: rolesA } = await supabase
    .from('roles')
    .select('id, title, org_id')
    .eq('org_id', orgA.id)
    .limit(1)

  const { data: rolesB } = await supabase
    .from('roles')
    .select('id, title, org_id')
    .eq('org_id', orgB.id)
    .limit(1)

  if (rolesA && rolesA.length > 0 && rolesB && rolesB.length > 0) {
    // Check if cross-org access is possible
    const { data: allRoles } = await supabase
      .from('roles')
      .select('id, org_id')

    const multipleOrgs = new Set(allRoles?.map(r => r.org_id)).size > 1

    if (multipleOrgs) {
      log(
        'Role cross-org access',
        false,
        `Service key can see roles from multiple orgs - application must filter by org_id`
      )
    }
  }

  // Test 4: Check RLS status on tables
  console.log('\n📋 Checking RLS Status on Tables:\n')

  const tablesToCheck = [
    'interviews',
    'candidates',
    'roles',
    'competencies',
    'questions',
    'knockout_questions',
    'knockout_responses',
    'error_logs',
    'organisations',
    'profiles',
  ]

  for (const table of tablesToCheck) {
    try {
      // Try to select from table - if RLS is enabled and no policy allows access, this might fail
      const { data, error } = await supabase.from(table).select('id').limit(1)

      if (error) {
        log(`RLS on ${table}`, true, 'RLS may be blocking access')
      } else {
        log(
          `RLS on ${table}`,
          false,
          `Table accessible with service key - ensure application filters by org_id`
        )
      }
    } catch (e) {
      console.log(`   ⚠️  Could not check table: ${table}`)
    }
  }

  // Test 5: Check error_logs isolation
  console.log('\n📋 Testing Error Logs Isolation:\n')

  const { data: errorLogs } = await supabase
    .from('error_logs')
    .select('id, interview_id')
    .limit(5)

  if (errorLogs && errorLogs.length > 0) {
    log(
      'Error logs access',
      false,
      `${errorLogs.length} error logs accessible - check if RLS policy is working`
    )
  } else {
    log('Error logs access', true, 'No error logs accessible or RLS is working')
  }

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
    console.log('\n⚠️  DATA ISOLATION ISSUES FOUND:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.test}: ${r.details}`)
    })

    console.log('\n🔧 RECOMMENDED FIXES:')
    console.log('   1. Enable RLS on all tables containing org-specific data')
    console.log('   2. Create RLS policies that filter by org_id')
    console.log('   3. Ensure all API endpoints filter queries by org_id')
    console.log('   4. Use anon key with RLS instead of service key where possible')
  }

  console.log('\n')
}

runDataIsolationTests().catch(console.error)
