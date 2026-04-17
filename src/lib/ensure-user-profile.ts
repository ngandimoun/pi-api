import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Ensures `public.users` has a row for this auth user (RLS must see JWT on the client).
 */
export async function ensureUserProfileRow(
  supabase: SupabaseClient<Database>,
  user: User
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error: selErr } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    return { ok: false, message: selErr.message };
  }
  if (row) {
    return { ok: true };
  }

  const email = user.email ?? "";
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const { error: insErr } = await supabase.from("users").insert({
    id: user.id,
    email,
    full_name: fullName,
    avatar_url: avatarUrl,
  });

  if (insErr?.code === "23505") {
    return { ok: true };
  }
  if (insErr) {
    return { ok: false, message: insErr.message };
  }
  return { ok: true };
}
