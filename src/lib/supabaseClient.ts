import { createClient } from '@supabase/supabase-js';

export const DB_SCHEMA = process.env.NEXT_PUBLIC_DB_SCHEMA || 'pro_consig';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: DB_SCHEMA
  }
});
