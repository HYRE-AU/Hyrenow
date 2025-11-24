/**
 * Script to search for candidates by name
 * Usage: node scripts/find-candidate.js <name>
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function findCandidate(searchName) {
  try {
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('id, name, email')
      .ilike('name', `%${searchName}%`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error:', error.message)
      return
    }

    if (!candidates || candidates.length === 0) {
      console.log(`❌ No candidates found matching "${searchName}"`)
      return
    }

    console.log(`✅ Found ${candidates.length} candidate(s) matching "${searchName}":\n`)
    candidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.name}`)
      console.log(`   Email: ${candidate.email}`)
      console.log(`   ID: ${candidate.id}`)
      console.log('')
    })
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Get command line arguments
const searchName = process.argv[2]

if (!searchName) {
  console.log('Usage: node scripts/find-candidate.js <name>')
  console.log('Example: node scripts/find-candidate.js Belle')
  process.exit(1)
}

findCandidate(searchName)
