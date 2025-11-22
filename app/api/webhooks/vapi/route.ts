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
    console.log('📦 Webhook body:', JSON.stringify(body, null, 2));

    const { message } = body;

    if (message?.type === 'end-of-call-report') {
      console.log('✅ End-of-call-report received');

      // Check multiple possible locations for metadata
      const interviewSlug =
        message?.call?.assistant?.metadata?.interviewSlug ||
        message?.call?.metadata?.interviewSlug ||
        message?.assistant?.metadata?.interviewSlug ||
        message?.metadata?.interviewSlug;

      console.log('🔍 Found interviewSlug:', interviewSlug);
      console.log('🔍 Checked paths:', {
        'message.call.assistant.metadata': message?.call?.assistant?.metadata,
        'message.call.metadata': message?.call?.metadata,
        'message.assistant.metadata': message?.assistant?.metadata,
        'message.metadata': message?.metadata
      });

      if (!interviewSlug) {
        console.error('❌ No interview slug found in any metadata location');
        return NextResponse.json({ error: 'No interview slug' }, { status: 400 });
      }

      // Get transcript and messages from the call object
      const transcript = message?.call?.transcript || message?.transcript || '';
      const messages = message?.call?.messages || message?.messages || [];

      console.log(`📝 Transcript length: ${transcript.length} chars`);
      console.log(`💬 Messages count: ${messages.length}`);

      if (!transcript || transcript.length === 0) {
        console.error('❌ No transcript found in webhook');
        console.error('Available fields:', Object.keys(message?.call || {}));
        return NextResponse.json({ error: 'No transcript available' }, { status: 400 });
      }

      // Update interview with transcript
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          transcript,
          vapi_messages: messages,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('slug', interviewSlug);

      if (updateError) {
        console.error('❌ Failed to update interview:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log('✅ Interview transcript saved successfully!');

      return NextResponse.json({ success: true });
    }

    console.log(`ℹ️ Unhandled message type: ${message?.type}`);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}