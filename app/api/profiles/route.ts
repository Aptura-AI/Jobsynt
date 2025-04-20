import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient'; // Adjust the path based on your structure

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Fetch profile data from Supabase or handle request logic
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(200).json(data);
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
