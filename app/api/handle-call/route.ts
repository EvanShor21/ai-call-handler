import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const speechResult = formData.get('SpeechResult') as string | null;

  if (speechResult && speechResult.trim() !== "") {
    const lowerSpeech = speechResult.toLowerCase();

    // Local FAQ shortcuts to avoid OpenAI call
    if (lowerSpeech.includes('hours')) {
      return fastResponse('Our office hours are Monday through Friday, 9 AM to 5 PM.');
    }
    if (lowerSpeech.includes('location') || lowerSpeech.includes('address')) {
      return fastResponse('We are located at 123 Main Street.');
    }
    if (lowerSpeech.includes('insurance')) {
      return fastResponse('We accept most major insurance plans. Please call during business hours for details.');
    }

    let aiResponse = 'I’m sorry, I didn’t understand that.';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 30,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a polite, helpful receptionist for a dental office. Provide concise responses.' },
          { role: 'user', content: speechResult }
        ]
      });
      aiResponse = completion.choices[0]?.message?.content || aiResponse;
    } catch (err) {
      aiResponse = "I'm sorry, there was a problem processing your request. Please call back later.";
    }

    aiResponse = escapeXML(aiResponse);

    return new NextResponse(
      `<Response>
        <Say voice="Polly.Joanna-Neural">${aiResponse}</Say>
        <Say>Thank you for calling. Goodbye.</Say>
      </Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    );
  }

  return new NextResponse(
    `<Response>
      <Gather input="speech" action="/api/handle-call" method="POST" timeout="8">
        <Say voice="Polly.Joanna-Neural">Hello! This is the dental office. How can I assist you today?</Say>
      </Gather>
      <Say>Sorry, I didn’t catch that. Goodbye.</Say>
    </Response>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    }
  );
}

function fastResponse(message: string) {
  const safeMessage = escapeXML(message);
  return new NextResponse(
    `<Response>
      <Say voice="Polly.Joanna-Neural">${safeMessage}</Say>
      <Say>Thank you for calling. Goodbye.</Say>
    </Response>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    }
  );
}

function escapeXML(str: string) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}
