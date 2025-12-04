import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function cleanup() {
  // Find test candidates
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id')
    .like('name', 'TEST - %')

  console.log('Found', candidates?.length || 0, 'test candidates to delete')

  if (candidates && candidates.length > 0) {
    const candidateIds = candidates.map(c => c.id)

    // Delete interviews first (foreign key)
    await supabase.from('interviews').delete().in('candidate_id', candidateIds)
    console.log('Deleted interviews')

    // Delete candidates
    await supabase.from('candidates').delete().in('id', candidateIds)
    console.log('Deleted candidates')
  }

  console.log('Cleanup complete')
}

cleanup()
