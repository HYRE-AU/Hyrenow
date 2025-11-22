import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📞 Vapi webhook received');

    const { message } = body;

    if (message?.type === 'end-of-call-report') {
      console.log('✅ End-of-call-report received');

      // Check multiple possible locations for metadata
      const interviewSlug =
        message?.call?.assistant?.metadata?.interviewSlug ||
        message?.call?.metadata?.interviewSlug ||
        message?.assistant?.metadata?.interviewSlug ||
        message?.metadata?.interviewSlug;

      console.log('🔍 Interview slug:', interviewSlug);

      if (!interviewSlug) {
        console.error('❌ No interview slug found in metadata');
        return NextResponse.json({ error: 'No interview slug' }, { status: 400 });
      }

      // Get transcript and messages from the call object
      const transcript = message?.call?.transcript || message?.transcript || '';
      const messages = message?.call?.messages || message?.messages || [];

      console.log(`📝 Transcript: ${transcript.length} chars, ${messages.length} messages`);

      if (!transcript || transcript.length === 0) {
        console.error('❌ No transcript found in webhook');
        return NextResponse.json({ error: 'No transcript available' }, { status: 400 });
      }

      // Get interview ID for evaluation
      const { data: interview, error: fetchError } = await supabase
        .from('interviews')
        .select('id')
        .eq('slug', interviewSlug)
        .single();

      if (fetchError || !interview) {
        console.error('❌ Failed to fetch interview:', fetchError);
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
      }

      // Update interview with transcript
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          transcript: { text: transcript },
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('slug', interviewSlug);

      if (updateError) {
        console.error('❌ Failed to update interview:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log('✅ Interview transcript saved successfully!');

      // Trigger evaluation now that transcript is saved
      console.log('✅ Triggering evaluation for interview:', interview.id);
      console.log('📊 Transcript available, length:', transcript.length, 'characters');

      // Trigger evaluation - must await to ensure it completes before function terminates
      try {
        console.log('🔄 Calling evaluation endpoint:', `${process.env.NEXT_PUBLIC_APP_URL}/api/interview/evaluate`);

        const evaluationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/interview/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interviewId: interview.id,
            transcript
          })
        });

        console.log('📡 Evaluation response status:', evaluationResponse.status);

        if (!evaluationResponse.ok) {
          const errorText = await evaluationResponse.text();
          console.error('❌ Evaluation trigger failed with status', evaluationResponse.status);
          console.error('❌ Error response:', errorText);
        } else {
          const result = await evaluationResponse.json();
          console.log('✅ Evaluation triggered successfully:', result);
        }
      } catch (err: any) {
        console.error('❌ Evaluation trigger exception:', err.message);
        console.error('❌ Error stack:', err.stack);
      }

      return NextResponse.json({ success: true });
    }

    console.log(`ℹ️ Unhandled message type: ${message?.type}`);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}