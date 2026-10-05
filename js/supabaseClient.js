import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://xfwvaxgqpfaoowebweuh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tTIJAGudwBpgl_re7Gj-RQ_ka69O2Db";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
