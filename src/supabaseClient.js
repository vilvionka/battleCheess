import { createClient } from '@supabase/supabase-js';

// Замени эти строки на реальные URL и Анон-ключ из твоего личного кабинета Supabase
const supabaseUrl = 'https://yppfnkdcojcnpddpopcn.supabase.co';
const supabaseAnonKey = 'sb_publishable_rBbZQTYoVOK2SK2BZOITdA_c1Anynul';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
