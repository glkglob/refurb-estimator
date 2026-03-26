import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

export type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

export const SUPABASE_CLIENT_UNAVAILABLE_MESSAGE =
  "Authentication and cloud sync are temporarily unavailable. Please try again shortly.";

export function createClient() {
  return createBrowserClient(
    getClientEnv().NEXT_PUBLIC_SUPABASE_URL,
    getClientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClientSafely(): BrowserSupabaseClient | null {
  try {
    return createClient();
  } catch (error) {
    console.error("[supabase/client] Failed to initialize browser client.", error);
    return null;
  }
}
