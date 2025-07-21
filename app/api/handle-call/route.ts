import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const speechResult = formData.get('SpeechResult') as string | null;

  if (speechResult && speechResult.trim() !== "") {
    let aiResponse = 'I’m sorry, I didn’t understand that.';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 30,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a polite, helpful receptionist for a dental office. Answer naturally and helpfully. Keep answers concise.' },
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
        <Gather input="speech" action="/api/handle-call" method="POST" timeout="8">
          <Say voice="Polly.Joanna-Neural">Is there anything else I can help you with?</Say>
        </Gather>
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

function escapeXML(str: string) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}
