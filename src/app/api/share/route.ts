import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type CreateShareRequestBody = {
  estimateData: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateShareRequestBody;

    if (!body || typeof body !== "object" || body.estimateData == null) {
      return NextResponse.json({ error: "estimateData is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient();

    const { data, error } = await supabaseAdmin
      .from("shared_estimates")
      .insert({
        estimate_data: body.estimateData,
        user_id: null
      })
      .select("token, expires_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to create share link" }, { status: 500 });
    }

    return NextResponse.json({
      token: data.token,
      expiresAt: data.expires_at
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient();

    const { data, error } = await supabaseAdmin
      .from("shared_estimates")
      .select("estimate_data, created_at, expires_at, view_count")
      .eq("token", token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const expiresAt = new Date(data.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }

    // Best-effort view count increment (do not block response on failure).
    supabaseAdmin
      .from("shared_estimates")
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq("token", token)
      .then()
      .catch(() => {});

    return NextResponse.json({
      estimateData: data.estimate_data,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      viewCount: data.view_count ?? 0
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
