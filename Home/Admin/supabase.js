const SUPABASE_URL =
  "https://zdinvxowzpkolbfzpcac.supabase.co/rest/v1/";

const SUPABASE_KEY =
  "sb_secret_DTrj2ilDnomG3lUBOqPZGQ_2fJNsjxb";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);