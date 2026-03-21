import { NextResponse, type NextRequest } from "next/server";

// Deprecated: use /api/v1/ routes. This redirect exists for backward compatibility.
export async function POST(request: NextRequest) {
  return NextResponse.rewrite(new URL("/api/v1/ai/photo-estimate", request.url));
}
