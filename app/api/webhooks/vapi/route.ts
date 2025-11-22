import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📞 Vapi webhook received - FULL BODY:', JSON.stringify(body, null, 2));

    const { message, call } = body;

    // Log the structure to see where metadata actually is
    console.log('🔍 Call object:', JSON.stringify(call, null, 2));
    console.log('🔍 Message object:', JSON.stringify(message, null, 2));

    // Handle end-of-call-report (when transcript is ready)
    if (message?.type === 'end-of-call-report') {
      console.log('✅ End-of-call-report received');
      
      // Try multiple possible locations for the slug
      const interviewSlug = 
        call?.metadata?.interviewSlug || 
        call?.assistantOverrides?.metadata?.interviewSlug ||
        message?.metadata?.interviewSlug ||
        body?.metadata?.interviewSlug;
      
      console.log('🔍 Looking for interviewSlug...');
      console.log('  - call?.metadata?.interviewSlug:', call?.metadata?.interviewSlug);
      console.log('  - call?.assistantOverrides?.metadata?.interviewSlug:', call?.assistantOverrides?.metadata?.interviewSlug);
      console.log('  - message?.metadata?.interviewSlug:', message?.metadata?.interviewSlug);
      console.log('  - body?.metadata?.interviewSlug:', body?.metadata?.interviewSlug);
      console.log('  - Final interviewSlug:', interviewSlug);
      
      if (!interviewSlug) {
        console.error('❌ No interview slug found in any location');
        console.error('Full call object keys:', Object.keys(call || {}));
        console.error('Full message object keys:', Object.keys(message || {}));
        return NextResponse.json({ error: 'No interview slug' }, { status: 400 });
      }

      console.log('✅ Found interviewSlug:', interviewSlug);

      // Get transcript and messages
      const transcript = message.transcript || message.artifact?.transcript || '';
      const messages = message.messages || message.artifact?.messages || [];
      
      console.log(`📝 Transcript length: ${transcript.length} chars`);
      console.log(`💬 Messages count: ${messages.length}`);

      if (!transcript && messages.length === 0) {
        console.error('❌ No transcript or messages in webhook!');
        return NextResponse.json({ error: 'No transcript data' }, { status: 400 });
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

      console.log('✅ Interview updated successfully with transcript');
      
      return NextResponse.json({ success: true });
    }

    // Handle other event types if needed
    console.log(`ℹ️ Unhandled message type: ${message?.type}`);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}