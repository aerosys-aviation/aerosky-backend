import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    console.error('CRITICAL: NEXT_PUBLIC_SUPABASE_URL is not set. Supabase client will not work.');
}

// Standard Supabase client for authentication and public operations
export const supabase: SupabaseClient = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

// Admin Supabase client (used for server-side administrative operations when service role key is provided)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null = serviceRoleKey
    ? createClient(supabaseUrl || '', serviceRoleKey, {
          auth: {
              persistSession: false,
              autoRefreshToken: false,
          },
      })
    : null;
