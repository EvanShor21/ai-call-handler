import { NextResponse } from 'next/server';

export async function POST() {
  const twiml = `
    <Response>
      <Gather input="speech" action="/api/handle-call" method="POST" timeout="5">
        <Say>Hello! How can we help you today?</Say>
      </Gather>
      <Say>We didn't hear anything. Goodbye!</Say>
    </Response>
  `;
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
}
