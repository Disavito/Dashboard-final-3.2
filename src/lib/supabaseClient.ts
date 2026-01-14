import { createClient } from '@supabase/supabase-js';

// Asegúrate de reemplazar estos valores con tus propias credenciales de Supabase
// Es recomendable usar variables de entorno para esto en un entorno de producción.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://n8n-supabase.mv7mvl.easypanel.host/';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is not set. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
} else {
  console.log('Supabase client initialized with URL:', supabaseUrl);
  // Por seguridad, evita registrar la clave anon completa en producción.
  // Para depuración, puedes ver los primeros caracteres.
  console.log('Supabase client initialized with Anon Key (first 10 chars):', supabaseAnonKey.substring(0, 10) + '...');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
