// lib/pdfcoClient.ts

export const parseResumeWithPdfCo = async (base64String: string) => {
  const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.PDF_CO_API_KEY || ''
    },
    body: JSON.stringify({
      file: `data:application/pdf;base64,${base64String}`
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("PDF.co Error:", err);
    throw new Error('Failed to parse resume');
  }

  const text = await response.text();
  return text; // returns plain text version of the resume
};
