import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

interface Session {
  messages: ChatCompletionMessageParam[];
}

const sessions = new Map<string, Session>();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult') as string | null;
    const toNumber = formData.get('To') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    console.log(`Incoming call: CallSid=${callSid}, To=${toNumber}, SpeechResult="${speechResult}"`);

    if (!callSid) {
      console.warn('Missing CallSid');
      return xmlResponse(`<Response><Say>We could not identify this call. Goodbye.</Say></Response>`);
    }

    if (!speechResult || !speechResult.trim()) {
      console.warn(`Empty speechResult for CallSid=${callSid}`);
      return xmlResponse(`<Response><Say>I didn’t hear anything. Please call back during office hours. Goodbye.</Say></Response>`);
    }

    if (!toNumber) {
      console.warn(`Missing destination number for CallSid=${callSid}`);
      return xmlResponse(`<Response><Say>We could not identify the destination number. Goodbye.</Say></Response>`);
    }

    const cleanTo = toNumber.trim();
    const cleanSpeech = speechResult.trim();

    const { data: office, error } = await supabase
      .from('offices')
      .select('*')
      .eq('phone', cleanTo)
      .single();

    if (error || !office) {
      console.warn(`Office not found for To=${cleanTo}`);
      return xmlResponse(`<Response><Say>Sorry, we could not retrieve office information. Please call back later. Goodbye.</Say></Response>`);
    }

    console.log(`Matched office: ${office.name}`);

    const doctors = (office.doctors || []).map((doc: any) =>
      `${doc.name} (${doc.specialty}, ${doc.aggressiveness} scheduler)`
    ).join(', ');

    const systemPrompt = `You are a polite receptionist for ${office.name}. Doctors include ${doctors || 'none listed'}. We accept ${office.insurance || 'no listed insurances'}. Office hours: ${office.hours || 'not provided'}. Address: ${office.address || 'not provided'}.`;

    let session = sessions.get(callSid);
    if (!session) {
      console.log(`Starting new session for CallSid=${callSid}`);
      session = { messages: [{ role: 'system', content: systemPrompt }] };
      sessions.set(callSid, session);
    }

    session.messages.push({ role: 'user', content: cleanSpeech });

    console.log(`Calling OpenAI for CallSid=${callSid}, messages so far:`, JSON.stringify(session.messages));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: session.messages
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I’m sorry, I didn’t understand that.';
    session.messages.push({ role: 'assistant', content: aiResponse });

    console.log(`AI response for CallSid=${callSid}: "${aiResponse}"`);

    return xmlResponse(`<Response><Say>${aiResponse}</Say></Response>`);
  } catch (e: any) {
    console.error('Unexpected error in handle-call:', e);
    return xmlResponse(`<Response><Say>Sorry, something went wrong. Please call back later. Goodbye.</Say></Response>`);
  }
}

function xmlResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
}
