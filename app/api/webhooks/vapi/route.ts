import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/errorLogger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  let interviewSlug: string | undefined;
  let vapiCallId: string | undefined;

  try {
    const body = await request.json();

    console.log('📞 Vapi webhook received');

    const { message } = body;

    if (message?.type === 'end-of-call-report') {
      console.log('✅ End-of-call-report received');

      // Extract Vapi call ID for idempotency
      vapiCallId = message?.call?.id;
      console.log('🔑 Vapi call ID:', vapiCallId);

      // Check multiple possible locations for metadata
      interviewSlug =
        message?.call?.assistant?.metadata?.interviewSlug ||
        message?.call?.metadata?.interviewSlug ||
        message?.assistant?.metadata?.interviewSlug ||
        message?.metadata?.interviewSlug;

      console.log('🔍 Interview slug:', interviewSlug);

      if (!interviewSlug) {
        console.error('❌ No interview slug found in metadata');
        await logError({
          endpoint: '/api/webhooks/vapi',
          errorType: 'validation_error',
          errorMessage: 'No interview slug found in Vapi webhook metadata',
          requestBody: { messageType: message?.type, hasCall: !!message?.call }
        });
        return NextResponse.json({ error: 'No interview slug' }, { status: 400 });
      }

      // Get transcript and messages from the call object
      const transcript = message?.call?.transcript || message?.transcript || '';
      const messages = message?.call?.messages || message?.messages || [];
      const recordingUrl = message?.call?.recordingUrl || message?.recordingUrl || null;
      const stereoRecordingUrl = message?.call?.stereoRecordingUrl || message?.stereoRecordingUrl || null;

      console.log(`📝 Transcript: ${transcript.length} chars, ${messages.length} messages`);

      if (!transcript || transcript.length === 0) {
        console.error('❌ No transcript found in webhook');
        await logError({
          endpoint: '/api/webhooks/vapi',
          errorType: 'validation_error',
          errorMessage: 'No transcript in Vapi webhook payload',
          interviewSlug
        });
        return NextResponse.json({ error: 'No transcript available' }, { status: 400 });
      }

      // Get interview ID and check for idempotency
      const { data: interview, error: fetchError } = await supabase
        .from('interviews')
        .select('id, vapi_call_id, evaluation_status')
        .eq('slug', interviewSlug)
        .single();

      if (fetchError || !interview) {
        console.error('❌ Failed to fetch interview:', fetchError);
        await logError({
          endpoint: '/api/webhooks/vapi',
          errorType: 'interview_not_found',
          errorMessage: `Interview not found for slug: ${interviewSlug}`,
          interviewSlug,
          requestBody: { vapiCallId }
        });
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
      }

      // IDEMPOTENCY CHECK: Don't reprocess if already completed with same call ID
      if (interview.vapi_call_id === vapiCallId && interview.evaluation_status === 'completed') {
        console.log('⏭️ Webhook already processed for this call ID, skipping');
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // CONCURRENCY CHECK: Don't process if evaluation is currently in progress
      if (interview.evaluation_status === 'in_progress') {
        console.log('⏳ Evaluation already in progress, skipping duplicate webhook');
        return NextResponse.json({ success: true, message: 'Evaluation in progress' });
      }

      // Update interview with transcript and set evaluation_status to in_progress
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          transcript: { text: transcript, messages: messages },
          recording_url: recordingUrl || stereoRecordingUrl,
          vapi_call_id: vapiCallId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          evaluation_status: 'in_progress',
          evaluation_error: null // Clear any previous error
        })
        .eq('slug', interviewSlug);

      if (updateError) {
        console.error('❌ Failed to update interview:', updateError);
        await logError({
          endpoint: '/api/webhooks/vapi',
          errorType: 'transcript_save_failed',
          errorMessage: `Failed to save transcript: ${updateError.message}`,
          interviewId: interview.id,
          interviewSlug
        });
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log('✅ Interview transcript saved successfully!');

      // Trigger evaluation now that transcript is saved
      console.log('✅ Triggering evaluation for interview:', interview.id);
      console.log('📊 Transcript available, length:', transcript.length, 'characters');

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

          // Mark evaluation as pending_retry so it can be retried later
          await supabase
            .from('interviews')
            .update({
              evaluation_status: 'pending_retry',
              evaluation_error: `Evaluation failed (${evaluationResponse.status}): ${errorText.slice(0, 500)}`
            })
            .eq('id', interview.id);

          await logError({
            endpoint: '/api/webhooks/vapi',
            errorType: 'evaluation_failed',
            errorMessage: `Evaluation returned ${evaluationResponse.status}: ${errorText.slice(0, 500)}`,
            interviewId: interview.id,
            interviewSlug
          });

          // Still return success - transcript is saved, evaluation can be retried
          return NextResponse.json({
            success: true,
            warning: 'Transcript saved but evaluation failed - marked for retry'
          });
        } else {
          const result = await evaluationResponse.json();
          console.log('✅ Evaluation triggered successfully:', result);

          // Evaluation endpoint should set evaluation_status to 'completed'
          // but let's make sure it's set
          await supabase
            .from('interviews')
            .update({
              evaluation_status: 'completed',
              evaluation_completed_at: new Date().toISOString(),
              evaluation_error: null
            })
            .eq('id', interview.id);
        }
      } catch (evalError: any) {
        console.error('❌ Evaluation trigger exception:', evalError.message);
        console.error('❌ Error stack:', evalError.stack);

        // Mark evaluation as pending_retry
        await supabase
          .from('interviews')
          .update({
            evaluation_status: 'pending_retry',
            evaluation_error: `Evaluation exception: ${evalError.message}`
          })
          .eq('id', interview.id);

        await logError({
          endpoint: '/api/webhooks/vapi',
          errorType: 'evaluation_failed',
          errorMessage: evalError.message,
          errorStack: evalError.stack,
          interviewId: interview.id,
          interviewSlug
        });

        // Still return success - transcript is saved
        return NextResponse.json({
          success: true,
          warning: 'Transcript saved but evaluation failed - marked for retry'
        });
      }

      return NextResponse.json({ success: true });
    }

    console.log(`ℹ️ Unhandled message type: ${message?.type}`);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);

    await logError({
      endpoint: '/api/webhooks/vapi',
      errorType: 'webhook_exception',
      errorMessage: error.message || 'Unknown webhook error',
      errorStack: error.stack,
      interviewSlug,
      requestBody: { vapiCallId }
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
