import { createSupabaseServerClient } from "@/lib/supabase-ssr";

/** Sunucu bileşenlerinde oturum açmış admin kontrolü. */
export async function isServerAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}
