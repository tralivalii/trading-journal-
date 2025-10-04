import { createClient } from '@supabase/supabase-js';

// Эти переменные должны быть доступны в окружении, где запускается код.
// В Vercel мы добавим их в настройках проекта.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
