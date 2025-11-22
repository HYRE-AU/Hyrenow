import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📞 Vapi webhook received:', JSON.stringify(body, null, 2));

    const { message, call } = body;

    // Handle end-of-call-report (when transcript is ready)
    if (message?.type === 'end-of-call-report') {
      console.log('✅ End-of-call-report received');
      
      const interviewSlug = call?.metadata?.interviewSlug;
      
      if (!interviewSlug) {
        console.error('❌ No interview slug in metadata');
        return NextResponse.json({ error: 'No interview slug' }, { status: 400 });
      }

      // Get transcript and messages
      const transcript = message.transcript || '';
      const messages = message.messages || [];
      
      console.log(`📝 Transcript length: ${transcript.length} chars`);
      console.log(`💬 Messages count: ${messages.length}`);

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

      console.log('✅ Interview updated successfully');
      
      // TODO: Trigger evaluation here if you want
      
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