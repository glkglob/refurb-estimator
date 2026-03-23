import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    getClientEnv().NEXT_PUBLIC_SUPABASE_URL,
    getClientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
