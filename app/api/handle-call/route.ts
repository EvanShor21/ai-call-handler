import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const speechResult = formData.get('SpeechResult') as string | null;
  const toNumber = formData.get('To') as string | null;

  if (!speechResult || !speechResult.trim()) {
    return xmlResponse(`<Response><Say>I didn’t hear anything. Please call back during office hours. Goodbye.</Say></Response>`);
  }

  if (!toNumber) {
    return xmlResponse(`<Response><Say>We could not identify the destination number. Goodbye.</Say></Response>`);
  }

  // Look up the office by phone number
  const { data: office, error } = await supabase
    .from('offices')
    .select('*')
    .eq('phone', toNumber)
    .single();

  if (error || !office) {
    return xmlResponse(`<Response><Say>Sorry, we could not retrieve office information. Please call back later. Goodbye.</Say></Response>`);
  }

  // Build system prompt dynamically
  const doctors = (office.doctors || []).map((doc: any) =>
    `${doc.name} (${doc.specialty}, ${doc.aggressiveness} scheduler)`
  ).join(', ');

  const systemPrompt = `You are a polite receptionist for ${office.name}. Doctors include ${doctors || 'none listed'}. We accept ${office.insurance || 'no listed insurances'}. Office hours: ${office.hours || 'not provided'}. Address: ${office.address || 'not provided'}.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: speechResult }
    ]
  });

  const aiResponse = completion.choices[0]?.message?.content || 'I’m sorry, I didn’t understand that.';

  return xmlResponse(`<Response><Say>${aiResponse}</Say></Response>`);
}

// Helper for Twilio XML response
function xmlResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
}
