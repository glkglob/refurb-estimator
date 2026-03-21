import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id ?? "no-user")
      .maybeSingle();

    return NextResponse.json({
      user: { id: user?.id, email: user?.email },
      userError: userError?.message ?? null,
      profile,
      profileError: profileError?.message ?? null,
      profileErrorCode: (profileError as { code?: string } | null)?.code ?? null
    });
  } catch (err) {
    return NextResponse.json(
      {
        fatal: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}
