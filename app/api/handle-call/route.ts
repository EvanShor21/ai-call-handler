import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

// Explicit Session interface
interface Session {
  messages: ChatCompletionMessageParam[];
}

// In-memory session store (temporary for MVP)
const sessions = new Map<string, Session>();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const speechResult = formData.get('SpeechResult') as string | null;
  const toNumber = formData.get('To') as string | null;
  const callSid = formData.get('CallSid') as string | null;

  if (!callSid) {
    return xmlResponse(`<Response><Say>We could not identify this call. Goodbye.</Say></Response>`);
  }

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

  const doctors = (office.doctors || []).map((doc: any) =>
    `${doc.name} (${doc.specialty}, ${doc.aggressiveness} scheduler)`
  ).join(', ');

  const systemPrompt = `You are a polite receptionist for ${office.name}. Doctors include ${doctors || 'none listed'}. We accept ${office.insurance || 'no listed insurances'}. Office hours: ${office.hours || 'not provided'}. Address: ${office.address || 'not provided'}.`;

  let session = sessions.get(callSid);
  if (!session) {
    session = { messages: [{ role: 'system', content: systemPrompt }] };
    sessions.set(callSid, session);
  }

  session.messages.push({ role: 'user', content: speechResult });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: session.messages
  });

  const aiResponse = completion.choices[0]?.message?.content || 'I’m sorry, I didn’t understand that.';
  session.messages.push({ role: 'assistant', content: aiResponse });

  return xmlResponse(`<Response><Say>${aiResponse}</Say></Response>`);
}

function xmlResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
}
