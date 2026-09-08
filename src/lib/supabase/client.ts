import { createBrowserClient } from "@supabase/ssr";

/**
 * Anon/public Supabase client for browser use.
 * Scoped by Row Level Security — never gets service-role access.
 * Only NEXT_PUBLIC_* vars are used here, safe to ship in the client bundle.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
