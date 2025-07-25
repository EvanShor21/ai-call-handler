import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const sessions = new Map();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult') as string | null;
    const toNumber = formData.get('To') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    if (!speechResult || !speechResult.trim()) {
      return xmlResponse(`<Response><Say>I didn’t hear anything. Please call back during office hours. Goodbye.</Say></Response>`);
    }

    if (!toNumber) {
      return xmlResponse(`<Response><Say>We could not identify the destination number. Goodbye.</Say></Response>`);
    }

    const { data: office, error } = await supabase
      .from('offices')
      .select('*')
      .eq('phone', toNumber)
      .single();

    if (error || !office) {
      return xmlResponse(`<Response><Say>Sorry, we could not retrieve office information. Please call back later. Goodbye.</Say></Response>`);
    }

    if (!sessions.has(callSid)) {
      sessions.set(callSid, { messages: [] });
    }
    const session = sessions.get(callSid);

    const doctors = (office.doctors || []).map((doc: any) =>
      `${doc.name} (${doc.specialty}, ${doc.aggressiveness} scheduler)`
    ).join(', ');

    const systemPrompt = `You are a polite receptionist for ${office.name}. Doctors include ${doctors || 'none listed'}. We accept ${office.insurance || 'no listed insurances'}. Office hours: ${office.hours || 'not provided'}. Address: ${office.address || 'not provided'}.`;

    if (session.messages.length === 0) {
      session.messages.push({ role: 'system', content: systemPrompt });
    }

    session.messages.push({ role: 'user', content: speechResult });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: session.messages
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I’m sorry, I didn’t understand that.';
    session.messages.push({ role: 'assistant', content: aiResponse });

    console.log(`AI response for CallSid=${callSid}: ${aiResponse}`);

    return xmlResponse(`
      <Response>
        <Say>${aiResponse}</Say>
        <Gather input="speech" action="/api/handle-call" method="POST" timeout="5">
          <Say>Anything else I can help you with?</Say>
        </Gather>
        <Say>Goodbye.</Say>
      </Response>
    `);

  } catch (e: any) {
    console.error('Unexpected error in handle-call:', e);
    return xmlResponse(`<Response><Say>Sorry, something went wrong. Please try again later.</Say></Response>`);
  }
}

function xmlResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
}
