const SUPABASE_URL =
  "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

const SUPABASE_KEY =
  "sb_secret_DTrj2ilDnomG3lUBOqPZGQ_2fJNsjxb";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);