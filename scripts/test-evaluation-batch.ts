/**
 * Batch Evaluation Test Script
 *
 * Tests the evaluation system by generating transcripts for different candidate
 * quality levels and verifying the scoring produces expected recommendations.
 *
 * Usage:
 *   npx ts-node scripts/test-evaluation-batch.ts --role-id=<uuid>
 *
 * Example:
 *   npx ts-node scripts/test-evaluation-batch.ts --role-id=e73dd396-a1a7-4c2a-91cb-d6962db8b442
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { nanoid } from 'nanoid'
import * as readline from 'readline'

// Load environment variables
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Candidate profiles for testing
const CANDIDATE_PROFILES = [
  {
    name: 'Excellent',
    targetScores: [4, 4, 4, 4, 4],
    expectedRecommendation: 'strong yes',
    expectedScoreRange: [80, 100],
    answerGuidance: `Generate answers demonstrating MASTERY:
- Provide specific, detailed examples with concrete metrics and outcomes
- Use clear STAR format (Situation, Task, Action, Result)
- Show leadership, innovation, and impact beyond expectations
- Include quantifiable achievements (percentages, dollar amounts, team sizes)
- Demonstrate proactive problem-solving and strategic thinking
- Show ability to mentor others and drive organizational change`
  },
  {
    name: 'Good',
    targetScores: [3, 4, 3, 3, 4],
    expectedRecommendation: 'yes',
    expectedScoreRange: [65, 79],
    answerGuidance: `Generate answers demonstrating COMPETENCE:
- Provide decent examples but with less specific metrics
- Show solid understanding and execution of responsibilities
- Include relevant experience that meets the requirements
- Answers should be complete but not exceptional
- Some examples may lack full detail or quantification
- Demonstrate reliability and consistent performance`
  },
  {
    name: 'Average',
    targetScores: [2, 3, 2, 3, 2],
    expectedRecommendation: 'borderline',
    expectedScoreRange: [50, 64],
    answerGuidance: `Generate answers showing PARTIAL competence:
- Provide generic answers with limited specifics
- Show basic understanding but some gaps in experience
- Include vague references to accomplishments without clear metrics
- Answers may be rambling or unfocused at times
- Some relevant experience but not directly applicable
- Demonstrate potential but lack of proven track record`
  },
  {
    name: 'Weak',
    targetScores: [2, 2, 1, 2, 2],
    expectedRecommendation: 'no',
    expectedScoreRange: [35, 49],
    answerGuidance: `Generate answers showing LIMITED competence:
- Provide minimal or superficial examples
- Show gaps in understanding of core competencies
- Answers lack concrete examples or achievements
- May give theoretical answers without practical application
- Demonstrate little relevant experience
- Short answers that don't fully address the question`
  },
  {
    name: 'Poor',
    targetScores: [1, 1, 1, 2, 1],
    expectedRecommendation: 'strong no',
    expectedScoreRange: [0, 34],
    answerGuidance: `Generate answers showing INADEQUATE competence:
- Provide vague, irrelevant, or very short answers
- Show fundamental misunderstanding of the competency
- No concrete examples or completely off-topic responses
- May express uncertainty or lack of experience
- Answers demonstrate no relevant background
- One-liner responses that don't demonstrate any competency`
  }
]

interface Competency {
  id: string
  name: string
  description: string
  weight: number
  bars_rubric: {
    level_1: { label: string; description: string }
    level_2: { label: string; description: string }
    level_3: { label: string; description: string }
    level_4: { label: string; description: string }
  }
}

interface Question {
  id: string
  text: string
  type: string
  order_index: number
  competencies: Competency
}

interface Role {
  id: string
  title: string
  jd_text: string
  org_id: string
}

interface TestResult {
  candidateName: string
  candidateId: string
  interviewId: string
  recommendation: string
  score: number
  confidence: string
  competencyScores: Array<{
    competency_name: string
    raw_score: number
    weight: number
  }>
  expectedRecommendation: string
  expectedScoreRange: [number, number]
  matchesExpected: boolean
  mismatchReason?: string
}

async function fetchRoleData(roleId: string): Promise<{ role: Role; questions: Question[] }> {
  console.log(`\nFetching role data for: ${roleId}`)

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, title, jd_text, org_id')
    .eq('id', roleId)
    .single()

  if (roleError || !role) {
    throw new Error(`Role not found: ${roleError?.message || 'Unknown error'}`)
  }

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select(`
      id,
      text,
      type,
      order_index,
      competencies (
        id,
        name,
        description,
        weight,
        bars_rubric
      )
    `)
    .eq('role_id', roleId)
    .eq('type', 'interview')
    .order('order_index')

  if (questionsError) {
    throw new Error(`Failed to fetch questions: ${questionsError.message}`)
  }

  if (!questions || questions.length === 0) {
    throw new Error('No interview questions found for this role')
  }

  console.log(`Found role: ${role.title}`)
  console.log(`Found ${questions.length} interview questions`)

  return { role: role as Role, questions: questions as unknown as Question[] }
}

async function generateTranscript(
  role: Role,
  questions: Question[],
  profile: typeof CANDIDATE_PROFILES[0]
): Promise<string> {
  console.log(`  Generating transcript for ${profile.name} candidate...`)

  const competencyDetails = questions.map((q, i) => {
    const targetScore = profile.targetScores[i % profile.targetScores.length]
    const rubricLevel = `level_${targetScore}` as keyof typeof q.competencies.bars_rubric
    const rubric = q.competencies.bars_rubric[rubricLevel]

    return {
      question: q.text,
      competency: q.competencies.name,
      targetScore,
      rubricDescription: rubric.description,
      weight: q.competencies.weight
    }
  })

  const prompt = `You are generating a realistic interview transcript for testing an evaluation system.

ROLE: ${role.title}

JOB DESCRIPTION:
${role.jd_text?.substring(0, 2000) || 'N/A'}

CANDIDATE PROFILE: ${profile.name.toUpperCase()} CANDIDATE
${profile.answerGuidance}

Generate a transcript where the interviewer asks each question and the candidate responds.
The candidate's answers should match the target quality level for each competency.

QUESTIONS AND TARGET PERFORMANCE:
${competencyDetails.map((q, i) => `
Question ${i + 1}: "${q.question}"
- Competency: ${q.competency} (Weight: ${q.weight === 3 ? 'Critical' : q.weight === 2 ? 'Important' : 'Nice-to-have'})
- Target Score: ${q.targetScore}/4
- Rubric for level ${q.targetScore}: "${q.rubricDescription}"
`).join('\n')}

FORMAT THE TRANSCRIPT EXACTLY LIKE THIS:
Interviewer: [First question]

Candidate: [Answer matching target score]

Interviewer: [Second question]

Candidate: [Answer matching target score]

... and so on for all questions.

IMPORTANT:
- Each answer should clearly demonstrate (or fail to demonstrate) the competency at the target level
- Use the rubric description as a guide for the quality of the answer
- Keep answers realistic - 2-5 sentences for poor candidates, 5-10 sentences for excellent candidates
- Do not include any meta-commentary, just the interview dialogue`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000
  })

  return completion.choices[0].message.content || ''
}

async function createTestRecords(
  role: Role,
  candidateName: string
): Promise<{ candidateId: string; interviewId: string }> {
  // Create test candidate
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .insert({
      org_id: role.org_id,
      name: `TEST - ${candidateName} Candidate`,
      email: `test-${candidateName.toLowerCase()}-${nanoid(6)}@test.local`
    })
    .select()
    .single()

  if (candidateError) {
    throw new Error(`Failed to create candidate: ${candidateError.message}`)
  }

  // Create test interview
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert({
      org_id: role.org_id,
      role_id: role.id,
      candidate_id: candidate.id,
      slug: `test-${nanoid(10)}`,
      status: 'completed',
      evaluation_status: 'pending'
    })
    .select()
    .single()

  if (interviewError) {
    throw new Error(`Failed to create interview: ${interviewError.message}`)
  }

  return {
    candidateId: candidate.id,
    interviewId: interview.id
  }
}

async function triggerEvaluation(interviewId: string, transcript: string): Promise<void> {
  // Set evaluation_status to 'pending' - the cron job or direct call will process it
  const { error: updateError } = await supabase
    .from('interviews')
    .update({
      transcript: transcript,
      evaluation_status: 'pending'
    })
    .eq('id', interviewId)

  if (updateError) {
    throw new Error(`Failed to set pending status: ${updateError.message}`)
  }

  // Call the cron endpoint to process immediately (for testing)
  // In production, the cron runs every minute automatically
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || 'test-secret'

  try {
    const { execSync } = await import('child_process')
    execSync(
      `curl -s -X GET "${baseUrl}/api/cron/process-evaluations" -H "Authorization: Bearer ${cronSecret}" --max-time 300`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    )
  } catch (error: any) {
    // Cron endpoint may timeout but evaluation continues in background
    console.log('  Cron trigger sent (may timeout, evaluation continues)')
  }
}

async function pollForCompletion(interviewId: string, maxAttempts = 150): Promise<any> {
  // Poll for up to 5 minutes (150 attempts x 2 seconds = 300 seconds)
  for (let i = 0; i < maxAttempts; i++) {
    const { data: interview, error } = await supabase
      .from('interviews')
      .select('evaluation_status, structured_evaluation, score, recommendation, evaluation_error')
      .eq('id', interviewId)
      .single()

    if (error) {
      throw new Error(`Failed to poll interview: ${error.message}`)
    }

    if (interview.evaluation_status === 'completed') {
      return interview
    }

    if (interview.evaluation_status === 'failed') {
      throw new Error(`Evaluation failed: ${interview.evaluation_error || 'Unknown error'}`)
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (i % 10 === 0) {
      process.stdout.write('.')
    }
  }

  throw new Error('Evaluation timed out after 5 minutes')
}

function checkExpectations(
  result: any,
  profile: typeof CANDIDATE_PROFILES[0]
): { matches: boolean; reason?: string } {
  const score = result.score
  const recommendation = result.recommendation

  const [minScore, maxScore] = profile.expectedScoreRange

  if (score < minScore) {
    return {
      matches: false,
      reason: `Score ${score}% below expected range [${minScore}-${maxScore}%] - EVALUATION TOO HARSH`
    }
  }

  if (score > maxScore) {
    return {
      matches: false,
      reason: `Score ${score}% above expected range [${minScore}-${maxScore}%] - EVALUATION TOO LENIENT`
    }
  }

  // Check recommendation matches
  const expectedRec = profile.expectedRecommendation
  if (recommendation !== expectedRec) {
    // Allow some flexibility for borderline cases
    const acceptableRecs: Record<string, string[]> = {
      'strong yes': ['strong yes', 'yes'],
      'yes': ['yes', 'strong yes', 'borderline'],
      'borderline': ['borderline', 'yes', 'no'],
      'no': ['no', 'borderline', 'strong no'],
      'strong no': ['strong no', 'no']
    }

    if (!acceptableRecs[expectedRec]?.includes(recommendation)) {
      return {
        matches: false,
        reason: `Expected "${expectedRec}" but got "${recommendation}"`
      }
    }
  }

  return { matches: true }
}

async function runTests(roleId: string): Promise<TestResult[]> {
  const results: TestResult[] = []
  const testData: Array<{ candidateId: string; interviewId: string }> = []

  try {
    // Fetch role data
    const { role, questions } = await fetchRoleData(roleId)

    console.log('\n' + '='.repeat(70))
    console.log('BATCH EVALUATION TEST')
    console.log('='.repeat(70))
    console.log(`Role: ${role.title}`)
    console.log(`Questions: ${questions.length}`)
    console.log(`Competencies: ${questions.map(q => q.competencies.name).join(', ')}`)
    console.log('='.repeat(70) + '\n')

    // Run tests for each candidate profile
    for (const profile of CANDIDATE_PROFILES) {
      console.log(`\n${'─'.repeat(50)}`)
      console.log(`Testing: ${profile.name} Candidate`)
      console.log(`${'─'.repeat(50)}`)

      try {
        // Generate transcript
        const transcript = await generateTranscript(role, questions, profile)
        console.log(`  Transcript generated (${transcript.length} chars)`)

        // Create test records
        const { candidateId, interviewId } = await createTestRecords(role, profile.name)
        testData.push({ candidateId, interviewId })
        console.log(`  Created test records`)

        // Update interview with transcript
        await supabase
          .from('interviews')
          .update({ transcript })
          .eq('id', interviewId)

        // Call evaluation endpoint
        console.log(`  Calling evaluation API...`)
        await triggerEvaluation(interviewId, transcript)

        // Poll for completion
        process.stdout.write('  Waiting for evaluation')
        const evalResult = await pollForCompletion(interviewId)
        console.log(' Done!')

        // Check expectations
        const { matches, reason } = checkExpectations(evalResult, profile)

        const testResult: TestResult = {
          candidateName: profile.name,
          candidateId,
          interviewId,
          recommendation: evalResult.recommendation,
          score: evalResult.score,
          confidence: evalResult.structured_evaluation?.confidence || 'unknown',
          competencyScores: evalResult.structured_evaluation?.competency_scores || [],
          expectedRecommendation: profile.expectedRecommendation,
          expectedScoreRange: profile.expectedScoreRange as [number, number],
          matchesExpected: matches,
          mismatchReason: reason
        }

        results.push(testResult)
        console.log(`  Result: ${evalResult.recommendation} (${evalResult.score}%)`)

        // Delay between evaluations to avoid overloading
        console.log(`  Waiting 5 seconds before next test...`)
        await new Promise(resolve => setTimeout(resolve, 5000))

      } catch (error: any) {
        console.error(`  ERROR: ${error.message}`)
        results.push({
          candidateName: profile.name,
          candidateId: '',
          interviewId: '',
          recommendation: 'ERROR',
          score: 0,
          confidence: 'none',
          competencyScores: [],
          expectedRecommendation: profile.expectedRecommendation,
          expectedScoreRange: profile.expectedScoreRange as [number, number],
          matchesExpected: false,
          mismatchReason: error.message
        })
      }
    }

    // Display results
    displayResults(results, questions)

    // Cleanup prompt
    await promptCleanup(testData)

  } catch (error: any) {
    console.error(`\nFATAL ERROR: ${error.message}`)
    // Attempt cleanup even on fatal error
    if (testData.length > 0) {
      await promptCleanup(testData)
    }
  }

  return results
}

function displayResults(results: TestResult[], questions: Question[]) {
  console.log('\n\n' + '═'.repeat(90))
  console.log('TEST RESULTS SUMMARY')
  console.log('═'.repeat(90))

  // Main results table
  console.log('\n┌─────────────┬────────────────┬───────────┬────────────┬──────────────────┐')
  console.log('│ Candidate   │ Recommendation │ Score %   │ Confidence │ Matches Expected?│')
  console.log('├─────────────┼────────────────┼───────────┼────────────┼──────────────────┤')

  for (const result of results) {
    const name = result.candidateName.padEnd(11)
    const rec = result.recommendation.padEnd(14)
    const score = `${result.score}%`.padEnd(9)
    const conf = result.confidence.padEnd(10)
    const match = result.matchesExpected ? '✅ Yes' : '❌ No'

    console.log(`│ ${name} │ ${rec} │ ${score} │ ${conf} │ ${match.padEnd(16)} │`)
  }

  console.log('└─────────────┴────────────────┴───────────┴────────────┴──────────────────┘')

  // Per-competency breakdown
  console.log('\n\nPER-COMPETENCY BREAKDOWN:')
  console.log('─'.repeat(90))

  const competencyNames = Array.from(new Set(questions.map(q => q.competencies.name)))

  for (const compName of competencyNames) {
    const question = questions.find(q => q.competencies.name === compName)
    const weight = question?.competencies.weight || 2
    const weightLabel = weight === 3 ? 'critical' : weight === 2 ? 'important' : 'nice-to-have'

    const scores = results.map(r => {
      const compScore = r.competencyScores.find(c => c.competency_name === compName)
      return compScore ? `${compScore.raw_score}/4` : 'N/A'
    })

    console.log(`\n${compName} (weight: ${weightLabel})`)
    console.log(`  ${results.map((r, i) => `${r.candidateName}: ${scores[i]}`).join(' | ')}`)
  }

  // Warnings for mismatches
  const mismatches = results.filter(r => !r.matchesExpected)
  if (mismatches.length > 0) {
    console.log('\n\n⚠️  WARNINGS:')
    console.log('─'.repeat(90))
    for (const mismatch of mismatches) {
      console.log(`⚠️  ${mismatch.candidateName} candidate: ${mismatch.mismatchReason}`)
    }
  }

  // Summary
  const passed = results.filter(r => r.matchesExpected).length
  const total = results.length
  const passRate = Math.round((passed / total) * 100)

  console.log('\n\n' + '═'.repeat(90))
  console.log(`OVERALL: ${passed}/${total} tests passed (${passRate}%)`)
  console.log('═'.repeat(90))
}

async function promptCleanup(testData: Array<{ candidateId: string; interviewId: string }>) {
  if (testData.length === 0) return

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise<void>((resolve) => {
    rl.question('\nDelete test data? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        console.log('\nCleaning up test data...')

        for (const { candidateId, interviewId } of testData) {
          if (interviewId) {
            // Delete related records first
            await supabase.from('question_evaluations').delete().eq('interview_id', interviewId)
            await supabase.from('screening_summaries').delete().eq('interview_id', interviewId)
            await supabase.from('interviews').delete().eq('id', interviewId)
          }
          if (candidateId) {
            await supabase.from('candidates').delete().eq('id', candidateId)
          }
        }

        console.log('✓ Test data deleted')
      } else {
        console.log('Test data retained for inspection')
        console.log('Interview IDs:', testData.map(d => d.interviewId).join(', '))
      }

      rl.close()
      resolve()
    })
  })
}

// Parse command line arguments
function parseArgs(): { roleId: string } {
  const args = process.argv.slice(2)
  let roleId = ''

  for (const arg of args) {
    if (arg.startsWith('--role-id=')) {
      roleId = arg.replace('--role-id=', '')
    }
  }

  if (!roleId) {
    console.error('Usage: npx ts-node scripts/test-evaluation-batch.ts --role-id=<uuid>')
    console.error('\nExample:')
    console.error('  npx ts-node scripts/test-evaluation-batch.ts --role-id=e73dd396-a1a7-4c2a-91cb-d6962db8b442')
    process.exit(1)
  }

  return { roleId }
}

// Main execution
async function main() {
  const { roleId } = parseArgs()

  console.log('Starting batch evaluation tests...')
  console.log(`Role ID: ${roleId}`)

  await runTests(roleId)
}

main().catch(console.error)
