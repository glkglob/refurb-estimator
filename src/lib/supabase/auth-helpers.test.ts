import {
  AuthError,
  handleAuthError,
  requireAuth
} from "./auth-helpers";
import { createServerSupabaseClient } from "./server";

jest.mock("./server", () => ({
  createServerSupabaseClient: jest.fn()
}));

const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);

type MockAuthUser = {
  id: string;
  email?: string | null;
};

type MockSupabaseOptions = {
  user?: MockAuthUser | null;
  userError?: { message: string } | null;
  profile?: { role?: string } | null;
  profileError?: {
    code?: string;
    message: string;
    hint?: string;
    details?: string;
  } | null;
};

function mockSupabaseClient(options: MockSupabaseOptions = {}) {
  const resolvedUser = options.user === undefined
    ? { id: "user-1", email: "user@example.com" }
    : options.user;

  const getUser = jest.fn().mockResolvedValue({
    data: {
      user: resolvedUser
    },
    error: options.userError ?? null
  });

  const single = jest.fn().mockResolvedValue({
    data: options.profile ?? { role: "customer" },
    error: options.profileError ?? null
  });

  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });

  const client = {
    auth: { getUser },
    from
  } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>;

  mockedCreateServerSupabaseClient.mockResolvedValue(client);

  return { getUser, from, select, eq, single };
}

describe("requireAuth", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns authenticated user when role is allowed", async () => {
    expect.hasAssertions();
    expect.assertions(3);

    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    // eslint-disable-next-line no-console
    console.log("[test] requireAuth execution checkpoint");
    expect(consoleLogSpy).toHaveBeenCalledWith("[test] requireAuth execution checkpoint");
    consoleLogSpy.mockRestore();

    const { from } = mockSupabaseClient({
      user: { id: "user-123", email: "me@example.com" },
      profile: { role: "tradesperson" }
    });

    await expect(requireAuth(["tradesperson", "admin"])).resolves.toEqual({
      id: "user-123",
      email: "me@example.com",
      role: "tradesperson"
    });

    expect(from).toHaveBeenCalledWith("profiles");
  });

  test("throws 401 when user lookup returns an error", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    mockSupabaseClient({ userError: { message: "token invalid" } });

    await expect(requireAuth()).rejects.toMatchObject({
      message: "Not authenticated",
      status: 401
    });
  });

  test("throws 401 when no user is authenticated", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    mockSupabaseClient({ user: null });

    await expect(requireAuth()).rejects.toMatchObject({
      message: "Not authenticated",
      status: 401
    });
  });

  test("throws 500 when profile query fails with non-not-found code", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    mockSupabaseClient({
      profileError: {
        code: "42P01",
        message: "relation does not exist"
      }
    });

    await expect(requireAuth()).rejects.toMatchObject({
      message: "Internal server error",
      status: 500
    });
  });

  test("defaults role to customer when profile is missing", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    mockSupabaseClient({
      user: { id: "user-42", email: null },
      profile: null,
      profileError: { code: "PGRST116", message: "No rows found" }
    });

    await expect(requireAuth()).resolves.toEqual({
      id: "user-42",
      email: "",
      role: "customer"
    });
  });

  test("defaults role to customer when profile role is invalid", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    mockSupabaseClient({
      profile: { role: "owner" }
    });

    await expect(requireAuth()).resolves.toMatchObject({ role: "customer" });
  });

  test("throws 403 when user role is not in allowed roles", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    mockSupabaseClient({
      profile: { role: "customer" }
    });

    await expect(requireAuth(["tradesperson"])).rejects.toMatchObject({
      message: "Insufficient permissions",
      status: 403
    });
  });
});

describe("handleAuthError", () => {
  test("returns auth error status and message for AuthError", async () => {
    expect.hasAssertions();
    expect.assertions(2);

    const response = handleAuthError(new AuthError("Not authenticated", 401));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
  });

  test("returns 500 for unknown errors", async () => {
    expect.hasAssertions();
    expect.assertions(2);

    const response = handleAuthError(new Error("boom"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
