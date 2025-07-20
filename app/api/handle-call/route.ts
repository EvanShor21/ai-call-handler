import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.text();
  console.log("Incoming call data:", body);

  return new NextResponse(
    `<Response><Say>Evan is so cute yes king. Josh loves cum balls.</Say></Response>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    }
  );
}

