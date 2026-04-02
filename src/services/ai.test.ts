import {
  AIDesignServiceError,
  generateDesign,
  type AiClientLike
} from "./ai";

type CreateCompletionFn = AiClientLike["chat"]["completions"]["create"];

function createMockClient(
  implementation?: jest.MockedFunction<CreateCompletionFn>
): AiClientLike {
  const create =
    implementation ??
    (jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              prompt: "Create a Scandinavian loft concept with natural timber and skylights.",
              seed: 123456,
              width: 1024,
              height: 768
            })
          }
        }
      ]
    }) as jest.MockedFunction<CreateCompletionFn>);

  return {
    chat: {
      completions: {
        create
      }
    }
  };
}

describe("services/ai.generateDesign", () => {
  const baseRequest = {
    imageUrl: "https://example.com/input.jpg",
    region: "london",
    projectType: "loft" as const,
    user: {
      userId: "user-1",
      email: "user@example.com",
      role: "customer"
    }
  };

  test("returns validated design metadata when AI response is valid", async () => {
    const client = createMockClient();

    const result = await generateDesign(baseRequest, {
      client,
      model: "gpt-test-model"
    });

    expect(result.prompt).toContain("Scandinavian loft concept");
    expect(result.seed).toBe(123456);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
    expect(result.model).toBe("gpt-test-model");
    expect(result.provider).toBe("openai");
  });

  test("creates deterministic seed when seed is missing from AI output", async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              prompt: "Design a practical new-build exterior with brick and zinc cladding."
            })
          }
        }
      ]
    }) as jest.MockedFunction<CreateCompletionFn>;
    const client = createMockClient(create);

    const first = await generateDesign(
      {
        ...baseRequest,
        projectType: "new_build",
        user: { ...baseRequest.user, userId: "same-user" }
      },
      { client }
    );
    const second = await generateDesign(
      {
        ...baseRequest,
        projectType: "new_build",
        user: { ...baseRequest.user, userId: "same-user" }
      },
      { client }
    );

    expect(first.seed).toBe(second.seed);
    expect(first.width).toBe(1024);
    expect(first.height).toBe(1024);
  });

  test("throws 502 when AI returns invalid JSON", async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "{invalid-json"
          }
        }
      ]
    }) as jest.MockedFunction<CreateCompletionFn>;

    const client = createMockClient(create);

    await expect(
      generateDesign(baseRequest, { client })
    ).rejects.toMatchObject({
      name: "AIDesignServiceError",
      statusCode: 502
    } satisfies Partial<AIDesignServiceError>);
  });

  test("maps network failures to 503", async () => {
    const create = jest.fn().mockRejectedValue(new Error("Network request failed")) as jest.MockedFunction<
      CreateCompletionFn
    >;
    const client = createMockClient(create);

    await expect(generateDesign(baseRequest, { client })).rejects.toMatchObject({
      statusCode: 503,
      message: "Network error while contacting AI generation service."
    } satisfies Partial<AIDesignServiceError>);
  });

  test("maps provider rate limits to 503", async () => {
    const create = jest.fn().mockRejectedValue({
      status: 429,
      message: "Too many requests"
    }) as jest.MockedFunction<CreateCompletionFn>;
    const client = createMockClient(create);

    await expect(generateDesign(baseRequest, { client })).rejects.toMatchObject({
      statusCode: 503,
      message: "AI service rate limit exceeded. Please retry shortly."
    } satisfies Partial<AIDesignServiceError>);
  });

  test("throws 500 when no API key is available and no client is injected", async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(generateDesign(baseRequest)).rejects.toMatchObject({
        statusCode: 500,
        message: "OPENAI_API_KEY is not configured."
      } satisfies Partial<AIDesignServiceError>);
    } finally {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });
});
