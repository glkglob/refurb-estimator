import { handleUpload } from "@/api/upload";

export async function POST(request: Request) {
  return handleUpload(request);
}
