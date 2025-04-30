// app/api/parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const { file } = await req.json();            // expects { file: base64String }
    const buffer = Buffer.from(file, 'base64');   // decode base64 → binary
    const { text } = await pdf(buffer);           // extract raw text
    return NextResponse.json({ text });
  } catch (err) {
    console.error('PDF parse error:', err);
    return NextResponse.json({ error: 'Failed to extract text' }, { status: 500 });
  }
}
