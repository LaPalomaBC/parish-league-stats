import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Public Supabase client (anon key).
 * RLS is enforced — can only SELECT public data (no adminConfig).
 * Use this for read-only access in Server Components and read-only API Routes.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin Supabase client (service_role key).
 * Bypasses RLS — full read/write access to all data including adminConfig.
 * ⚠️ Server-only! Never import this in Client Components.
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
