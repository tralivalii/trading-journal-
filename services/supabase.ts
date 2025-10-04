import { createClient } from '@supabase/supabase-js';

// The Supabase URL and public anonymous key are safe to be exposed in a client-side application.
// Row Level Security (RLS) is enabled in the Supabase database to ensure data is secure.
const supabaseUrl = 'https://mppxwfiazsyxmrmoyzzk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wcHh3ZmlhenN5eG1ybW95enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NTkxMjQsImV4cCI6MjA3NTEzNTEyNH0.WuSbzu4HpKlDSf7FUtCglQmE7a3wRMifih1SejcBO8A';

if (!supabaseUrl || !supabaseAnonKey) {
  // This check is kept just in case, but with hardcoded values, it should not be triggered.
  throw new Error("Supabase URL and Anon Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
