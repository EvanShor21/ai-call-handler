import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.text();
  console.log("Incoming call data:", body);

  return new NextResponse(
    `<Response><Say>Thank you for calling. This is a test response from your AI call handler.</Say></Response>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    }
  );
}

