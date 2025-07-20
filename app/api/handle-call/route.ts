import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const speechResult = formData.get('SpeechResult') as string | null;

  if (speechResult) {
    const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a polite, helpful receptionist for a dental office.' },
        { role: 'user', content: speechResult }
      ]
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I’m sorry, I didn’t understand that.';

    return new NextResponse(
      `<Response><Say>${aiResponse}</Say></Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    );
  }

  return new NextResponse(
    `<Response>
      <Gather input="speech" action="/api/handle-call" method="POST">
        <Say>Hello! This is the dental office. How can I help you today?</Say>
      </Gather>
    </Response>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    }
  );
}
