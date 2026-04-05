import {
  createCompletionWithOpenAI,
  generateImageWithOpenAI
} from "./adapter";

describe("lib/ai/adapter", () => {
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalUseOpenAi = process.env.USE_OPENAI;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.USE_OPENAI = "true";
  });

  afterEach(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }

    if (originalUseOpenAi === undefined) {
      delete process.env.USE_OPENAI;
    } else {
      process.env.USE_OPENAI = originalUseOpenAi;
    }
  });

  test("maps chat completion responses to legacy ai client shape", async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "{\"ok\":true}"
          },
          finish_reason: "stop"
        }
      ]
    });

    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    };

    const response = await createCompletionWithOpenAI(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Return JSON only" },
          { role: "user", content: "Generate a summary" }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      },
      mockClient as never
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(response.choices[0]?.message.content).toBe("{\"ok\":true}");
    expect(response.choices[0]?.finish_reason).toBe("stop");
  });

  test("handles multimodal user messages with image_url content parts", async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: [{ type: "text", text: "image analysis" }]
          }
        }
      ]
    });

    const mockClient = {
      chat: {
        completions: {
          create
        }
      }
    };

    const response = await createCompletionWithOpenAI(
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse this image" },
              { type: "image_url", image_url: { url: "https://example.com/room.jpg" } }
            ]
          }
        ]
      },
      mockClient as never
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(response.choices[0]?.message.content).toBe("image analysis");
  });

  test("maps image generation responses to urls and base64 lists", async () => {
    const generate = jest.fn().mockResolvedValue({
      data: [
        { url: "https://cdn.example.com/generated-1.png", b64_json: "abc123" },
        { url: "https://cdn.example.com/generated-2.png" }
      ]
    });

    const mockClient = {
      images: {
        generate
      }
    };

    const response = await generateImageWithOpenAI(
      {
        model: "gpt-image-1",
        prompt: "Generate a modern kitchen redesign",
        size: "1024x1024"
      },
      mockClient as never
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(response.urls).toEqual([
      "https://cdn.example.com/generated-1.png",
      "https://cdn.example.com/generated-2.png"
    ]);
    expect(response.b64Json).toEqual(["abc123"]);
  });

  test("throws when USE_OPENAI feature flag is false", async () => {
    process.env.USE_OPENAI = "false";

    await expect(
      createCompletionWithOpenAI(
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hello" }]
        },
        {
          chat: {
            completions: {
              create: jest.fn()
            }
          }
        } as never
      )
    ).rejects.toThrow("USE_OPENAI");
  });
});
