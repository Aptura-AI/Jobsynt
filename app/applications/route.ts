// app/api/applications/route.ts
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  const { candidate_id, job_id, status } = await req.json();

  const { data, error } = await supabase
    .from('applications')
    .insert([{ candidate_id, job_id, status }])
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify(data), { status: 201 });
}
