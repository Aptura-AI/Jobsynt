// lib/pdfcoClient.ts
export async function parseResumeWithPdfco(base64: string): Promise<string> {
  const apiKey = process.env.PDFCO_API_KEY;
  if (!apiKey) throw new Error('PDFCO_API_KEY is missing in env');

  const url = 'https://api.pdf.co/v1/pdf/convert/to/text';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'resume.pdf',
      file: base64,
      async: false,
    }),
  });

  type PdfCoResponse = {
    url?: string;
    error?: boolean;
    message?: string;
  };

  const data: PdfCoResponse = await response.json();

  if (!data.url) {
    throw new Error(`Failed to get PDF text URL: ${data.message || 'Unknown error'}`);
  }

  const textRes = await fetch(data.url);
  return await textRes.text();
}
