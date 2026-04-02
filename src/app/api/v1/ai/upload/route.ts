import { handleUpload } from "@/api/upload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleUpload(request);
}
