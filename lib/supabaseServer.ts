// lib/supabaseServer.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASEURL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASEKEY!;

// Named export called `supabaseServer`
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);
