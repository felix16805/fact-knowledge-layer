import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — use ONLY in API routes and server components, never in client code.
 * The service role key must never appear in the client bundle.
 */
export async function createAdminClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookie mutation is a no-op, which is fine
          }
        },
      },
    }
  );
}
