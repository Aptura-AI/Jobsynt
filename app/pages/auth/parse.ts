// pages/api/parse.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pdf from 'pdf-parse';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Assume req.body.file is a base64 string
    const buffer = Buffer.from(req.body.file, 'base64');
    const { text } = await pdf(buffer);
    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to extract text' });
  }
}
