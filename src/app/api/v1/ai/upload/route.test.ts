import { POST } from "./route";
import { requireRole } from "@/lib/rbac";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  AIDesignServiceError,
  generateDesign
} from "@/services/ai";

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: jest.fn()
}));

jest.mock("@/services/ai", () => {
  const actual = jest.requireActual("@/services/ai");
  return {
    ...actual,
    generateDesign: jest.fn()
  };
});

const mockedRequireRole = jest.mocked(requireRole);
const mockedCreateAdminSupabaseClient = jest.mocked(createAdminSupabaseClient);
const mockedGenerateDesign = jest.mocked(generateDesign);

type MockStorageError = {
  message: string;
  statusCode?: number;
};

function createMultipartRequest(options?: {
  file?: File;
  region?: string;
  projectType?: "loft" | "new_build";
  promptHint?: string;
  width?: string;
  height?: string;
}): Request {
  const formData = new FormData();
  formData.append(
    "file",
    options?.file ?? new File(["photo"], "room.jpg", { type: "image/jpeg" })
  );
  formData.append("region", options?.region ?? "london");
  formData.append("projectType", options?.projectType ?? "loft");
  if (options?.promptHint) {
    formData.append("promptHint", options.promptHint);
  }
  if (options?.width) {
    formData.append("width", options.width);
  }
  if (options?.height) {
    formData.append("height", options.height);
  }

  const request = new Request("http://localhost/api/v1/ai/upload", {
    method: "POST"
  });
  jest.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

function mockSupabase(options?: {
  uploadError?: MockStorageError | null;
  signedUrlError?: MockStorageError | null;
  signedUrl?: string;
  insertError?: { message: string } | null;
}) {
  const upload = jest.fn().mockResolvedValue({
    error: options?.uploadError ?? null
  });
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: options?.signedUrlError
      ? null
      : { signedUrl: options?.signedUrl ?? "https://signed.example.com/object" },
    error: options?.signedUrlError ?? null
  });
  const remove = jest.fn().mockResolvedValue({ error: null });

  const storageFrom = jest.fn().mockReturnValue({
    upload,
    createSignedUrl,
    remove
  });

  const insert = jest.fn().mockResolvedValue({
    error: options?.insertError ?? null
  });
  const from = jest.fn().mockReturnValue({ insert });

  mockedCreateAdminSupabaseClient.mockReturnValue({
    storage: {
      from: storageFrom
    },
    from
  } as unknown as ReturnType<typeof createAdminSupabaseClient>);

  return {
    upload,
    createSignedUrl,
    remove,
    storageFrom,
    insert,
    from
  };
}

describe("POST /api/v1/ai/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SUPABASE_DESIGN_UPLOAD_BUCKET;
    delete process.env.DESIGN_SIGNED_URL_EXPIRY_SECONDS;
    mockedRequireRole.mockResolvedValue({
      id: "user-123",
      email: "user@example.com",
      role: "customer"
    });
    mockedGenerateDesign.mockResolvedValue({
      prompt: "Refine loft layout with full-height storage and oak finishes.",
      seed: 998877,
      width: 1024,
      height: 1024,
      region: "london",
      provider: "openai",
      model: "gpt-4o-mini",
      createdAt: "2026-04-02T10:30:00.000Z"
    });
  });

  test("returns 201 for a successful upload and design workflow", async () => {
    const supabaseMocks = mockSupabase();
    const response = await POST(createMultipartRequest({ promptHint: "Warm modern style" }));
    const payload = (await response.json()) as {
      signedUrl: string;
      design: { seed: number; prompt: string };
      path: string;
      bucket: string;
    };

    expect(response.status).toBe(201);
    expect(payload.signedUrl).toContain("https://signed.example.com/");
    expect(payload.design.seed).toBe(998877);
    expect(payload.design.prompt).toContain("loft layout");
    expect(payload.path.startsWith("user-123/")).toBe(true);
    expect(payload.bucket).toBe("design-uploads");

    expect(mockedGenerateDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: "https://signed.example.com/object",
        region: "london",
        projectType: "loft",
        user: {
          userId: "user-123",
          email: "user@example.com",
          role: "customer"
        }
      })
    );
    expect(supabaseMocks.storageFrom).toHaveBeenCalledWith("design-uploads");
    expect(supabaseMocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        region: "london",
        project_type: "loft",
        prompt: "Refine loft layout with full-height storage and oak finishes.",
        seed: 998877,
        width: 1024,
        height: 1024
      })
    );
    expect(supabaseMocks.remove).not.toHaveBeenCalled();
  });

  test("returns 415 for non multipart requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/ai/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(415);
    expect(payload.error).toBe("Expected multipart/form-data upload request.");
  });

  test("returns 400 for invalid file type", async () => {
    const response = await POST(
      createMultipartRequest({
        file: new File(["bad"], "room.gif", { type: "image/gif" })
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid file type");
  });

  test("returns 400 for oversized files", async () => {
    const hugeFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.jpg", {
      type: "image/jpeg"
    });
    const response = await POST(createMultipartRequest({ file: hugeFile }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid file size");
  });

  test("returns 507 when storage quota is exceeded", async () => {
    mockSupabase({
      uploadError: {
        message: "Storage quota exceeded",
        statusCode: 413
      }
    });

    const response = await POST(createMultipartRequest());
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(507);
    expect(payload.error).toContain("Storage quota exceeded");
  });

  test("returns 503 on storage network errors", async () => {
    mockSupabase({
      uploadError: {
        message: "Network request failed while uploading"
      }
    });

    const response = await POST(createMultipartRequest());
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toContain("Network error");
  });

  test("returns 502 on generic storage upload failure", async () => {
    mockSupabase({
      uploadError: {
        message: "Unexpected upload rejection"
      }
    });

    const response = await POST(createMultipartRequest());
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Failed to upload file to storage.");
  });

  test("returns mapped AI error status when design generation fails", async () => {
    const supabaseMocks = mockSupabase();
    mockedGenerateDesign.mockRejectedValue(
      new AIDesignServiceError("AI provider is currently unavailable.", 503)
    );

    const response = await POST(createMultipartRequest());
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("AI provider is currently unavailable.");
    expect(supabaseMocks.remove).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.remove.mock.calls[0]?.[0]?.[0]).toMatch(/^user-123\//);
  });

  test("returns 400 for invalid metadata", async () => {
    const response = await POST(createMultipartRequest({ region: "not_a_region" }));
    const payload = (await response.json()) as { error: string; details: string[] };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid upload metadata.");
    expect(payload.details.length).toBeGreaterThan(0);
  });

  test("returns 503 when metadata persistence fails due to network", async () => {
    const supabaseMocks = mockSupabase({
      insertError: {
        message: "Network timeout while inserting row"
      }
    });

    const response = await POST(createMultipartRequest());
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Network error while saving design metadata.");
    expect(supabaseMocks.remove).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.remove.mock.calls[0]?.[0]?.[0]).toMatch(/^user-123\//);
  });

  test("cleans up uploaded file when signed URL creation fails", async () => {
    const supabaseMocks = mockSupabase({
      signedUrlError: {
        message: "Network request failed while signing URL"
      }
    });

    const response = await POST(createMultipartRequest());
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toContain("Network error");
    expect(supabaseMocks.remove).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.remove.mock.calls[0]?.[0]?.[0]).toMatch(/^user-123\//);
  });
});
