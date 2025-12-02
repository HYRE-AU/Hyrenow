const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function backfillRecordings() {
  // Get all completed interviews with vapi_call_id but no recording_url
  const { data: interviews, error } = await supabase
    .from('interviews')
    .select('id, slug, vapi_call_id, recording_url')
    .eq('status', 'completed')
    .not('vapi_call_id', 'is', null);

  if (error) {
    console.error('Error fetching interviews:', error);
    return;
  }

  console.log(`Found ${interviews.length} completed interviews with Vapi call IDs\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const interview of interviews) {
    if (interview.recording_url) {
      console.log(`✓ ${interview.slug}: Already has recording URL, skipping`);
      skipped++;
      continue;
    }

    console.log(`Processing ${interview.slug} (Vapi: ${interview.vapi_call_id})...`);

    try {
      const response = await fetch(`https://api.vapi.ai/call/${interview.vapi_call_id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
        }
      });

      if (!response.ok) {
        console.log(`  ❌ Failed to fetch from Vapi: ${response.status}`);
        failed++;
        continue;
      }

      const callData = await response.json();
      const recordingUrl = callData.recordingUrl || callData.artifact?.recordingUrl;

      if (recordingUrl) {
        const { error: updateError } = await supabase
          .from('interviews')
          .update({ recording_url: recordingUrl })
          .eq('id', interview.id);

        if (updateError) {
          console.log(`  ❌ Failed to update database: ${updateError.message}`);
          failed++;
        } else {
          console.log(`  ✅ Updated with recording URL`);
          updated++;
        }
      } else {
        console.log(`  ⚠️ No recording URL found in Vapi response`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had URL): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

backfillRecordings();
