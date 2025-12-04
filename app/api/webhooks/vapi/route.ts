import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/errorLogger';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Validates Vapi webhook signature
 * Returns true if valid or if verification is skipped in development
 */
function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // If no secret configured, skip verification but log warning
  if (!secret) {
    console.warn('⚠️ VAPI_WEBHOOK_SECRET not configured - skipping signature verification');
    return true;
  }

  if (!signature) {
    console.error('❌ No signature provided in webhook request');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('❌ Webhook signature mismatch');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Webhook signature validation error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  let interviewSlug: string | undefined;
  let vapiCallId: string | undefined;

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-vapi-signature');

    // Validate webhook signature
    const isValidSignature = validateWebhookSignature(
      rawBody,
      signature,
      process.env.VAPI_WEBHOOK_SECRET
    );

    if (!isValidSignature) {
      await logError({
        endpoint: '/api/webhooks/vapi',
        errorType: 'invalid_signature',
        errorMessage: 'Webhook signature verification failed',
        requestBody: { hasSignature: !!signature }
      });
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse the body after signature verification
    const body = JSON.parse(rawBody);

    console.log('📞 Vapi webhook received (signature verified)');

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

      // CONCURRENCY CHECK: Don't process if evaluation is currently in progress or pending
      if (interview.evaluation_status === 'processing' || interview.evaluation_status === 'pending') {
        console.log('⏳ Evaluation already queued or in progress, skipping duplicate webhook');
        return NextResponse.json({ success: true, message: 'Evaluation already queued' });
      }

      // Update interview with transcript and set evaluation_status to 'pending'
      // The cron job will pick this up and process the evaluation asynchronously
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          transcript: transcript, // Store raw transcript string for cron job
          recording_url: recordingUrl || stereoRecordingUrl,
          vapi_call_id: vapiCallId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          evaluation_status: 'pending', // Cron job will process this
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

      console.log('✅ Interview transcript saved, evaluation queued for processing');
      console.log('📊 Transcript length:', transcript.length, 'characters');

      // Return immediately - cron job will handle evaluation asynchronously
      return NextResponse.json({
        success: true,
        message: 'Transcript saved, evaluation queued'
      });
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
