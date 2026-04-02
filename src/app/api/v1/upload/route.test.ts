import { POST } from "./route";
import { requireRole } from "@/lib/rbac";
import { createServerSupabaseClient } from "@/lib/supabase/server";

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn()
}));

const mockedRequireRole = jest.mocked(requireRole);
const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/v1/upload", () => {
  const authenticatedUser: Awaited<ReturnType<typeof requireRole>> = {
    id: "user-123",
    email: "user@example.com",
    role: "customer"
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireRole.mockResolvedValue(authenticatedUser);
  });

  test("returns signed upload URL for gallery presign requests", async () => {
    const createSignedUploadUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: "https://signed-upload.example.com/path" },
      error: null
    });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: "https://public.example.com/gallery.jpg" }
    });
    const from = jest.fn().mockReturnValue({
      createSignedUploadUrl,
      getPublicUrl
    });

    mockedCreateServerSupabaseClient.mockResolvedValue({
      storage: { from }
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const response = await POST(
      createJsonRequest({
        action: "presign",
        bucket: "gallery",
        fileName: "kitchen.jpg",
        fileType: "image/jpeg",
        fileSize: 1024
      })
    );
    const payload = (await response.json()) as {
      uploadUrl: string;
      key: string;
      publicUrl: string;
    };

    expect(response.status).toBe(200);
    expect(payload.uploadUrl).toBe("https://signed-upload.example.com/path");
    expect(payload.publicUrl).toBe("https://public.example.com/gallery.jpg");
    expect(payload.key.startsWith("user-123/")).toBe(true);
    expect(payload.key.endsWith(".jpg")).toBe(true);
    expect(from).toHaveBeenCalledWith("gallery");
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ upsert: false })
    );
  });

  test("rejects confirm requests for keys outside the authenticated user folder", async () => {
    const from = jest.fn();
    mockedCreateServerSupabaseClient.mockResolvedValue({
      storage: { from }
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const response = await POST(
      createJsonRequest({
        action: "confirm",
        bucket: "gallery",
        key: "other-user/photo.jpg"
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid upload key");
    expect(from).not.toHaveBeenCalled();
  });

  test("returns public URL for valid confirm requests", async () => {
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: "https://public.example.com/user-123/photo.jpg" }
    });
    const from = jest.fn().mockReturnValue({ getPublicUrl });

    mockedCreateServerSupabaseClient.mockResolvedValue({
      storage: { from }
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const response = await POST(
      createJsonRequest({
        action: "confirm",
        bucket: "gallery",
        key: "user-123/photo.jpg"
      })
    );
    const payload = (await response.json()) as { url: string; key: string; bucket: string };

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://public.example.com/user-123/photo.jpg");
    expect(payload.key).toBe("user-123/photo.jpg");
    expect(payload.bucket).toBe("gallery");
    expect(from).toHaveBeenCalledWith("gallery");
  });

  test("keeps avatar form-data upload behavior", async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: "https://public.example.com/user-123/avatar.jpg" }
    });
    const from = jest.fn().mockReturnValue({
      upload,
      getPublicUrl
    });

    mockedCreateServerSupabaseClient.mockResolvedValue({
      storage: { from }
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const formData = new FormData();
    formData.append("file", new File(["avatar"], "avatar.jpg", { type: "image/jpeg" }));

    const request = new Request("http://localhost/api/v1/upload", {
      method: "POST"
    });
    jest.spyOn(request, "formData").mockResolvedValue(formData);

    const response = await POST(request);
    const payload = (await response.json()) as { url: string; path: string; bucket: string };

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://public.example.com/user-123/avatar.jpg");
    expect(payload.path).toBe("user-123/avatar.jpg");
    expect(payload.bucket).toBe("avatars");
    expect(from).toHaveBeenCalledWith("avatars");
    expect(upload).toHaveBeenCalledWith(
      "user-123/avatar.jpg",
      expect.any(File),
      expect.objectContaining({
        upsert: true,
        contentType: "image/jpeg"
      })
    );
  });
});
