const { createClient } = require("@supabase/supabase-js");
const { env } = require("./env");

function createSupabaseClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

const supabase = createSupabaseClient();

module.exports = { supabase };
