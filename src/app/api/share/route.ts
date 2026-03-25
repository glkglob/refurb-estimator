import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  parseSharedEstimateSnapshot,
  sharedEstimateSnapshotSchema,
  type SharedEstimateSnapshot,
} from "@/lib/share";
import { z } from "zod";

const createShareRequestSchema = z.object({
  estimateData: sharedEstimateSnapshotSchema,
});

type SharedEstimateRow = {
  token: string;
  expires_at: string;
  estimate_data: SharedEstimateSnapshot;
  created_at: string;
  view_count: number | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error";
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    const parsedBody = createShareRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonError("estimateData is required", 400);
    }

    const supabaseAdmin = createAdminSupabaseClient();

    const { data, error } = await supabaseAdmin
      .from("shared_estimates")
      .insert({
        estimate_data: parsedBody.data.estimateData,
        user_id: null,
      })
      .select("token, expires_at")
      .single<{ token: string; expires_at: string }>();

    if (error || !data) {
      return jsonError(error?.message ?? "Unable to create share link", 500);
    }

    return NextResponse.json({
      token: data.token,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      return jsonError("token is required", 400);
    }

    const supabaseAdmin = createAdminSupabaseClient();

    const { data, error } = await supabaseAdmin
      .from("shared_estimates")
      .select("estimate_data, created_at, expires_at, view_count")
      .eq("token", token)
      .single<SharedEstimateRow>();

    if (error || !data) {
      return jsonError("Not found", 404);
    }

    const parsedEstimate = parseSharedEstimateSnapshot(data.estimate_data);

    if (!parsedEstimate) {
      return jsonError("Invalid shared estimate data", 500);
    }

    const expiresAt = new Date(data.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return jsonError("Link expired", 410);
    }

    const currentViewCount = data.view_count ?? 0;

    // Async IIFE to handle view count increment
    try {
      await (async () => {
        await supabaseAdmin
          .from("shared_estimates")
          .update({ view_count: currentViewCount + 1 })
          .eq("token", token);
      })();
    } catch {
      // ignore
    }

    return NextResponse.json({
      estimateData: parsedEstimate,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      viewCount: currentViewCount,
    });
  } catch (error) {
    return jsonError(getErrorMessage(error), 500);
  }
}
