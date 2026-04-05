import { aiClient } from "./client";
import {
  createCompletionWithOpenAI,
  generateImageWithOpenAI
} from "./adapter";

jest.mock("./adapter", () => ({
  createCompletionWithOpenAI: jest.fn(),
  generateImageWithOpenAI: jest.fn()
}));

const mockedCreateCompletionWithOpenAI = jest.mocked(createCompletionWithOpenAI);
const mockedGenerateImageWithOpenAI = jest.mocked(generateImageWithOpenAI);

describe("lib/ai/client", () => {
  beforeEach(() => {
    mockedCreateCompletionWithOpenAI.mockReset();
    mockedGenerateImageWithOpenAI.mockReset();
  });

  test("delegates chat completion calls to adapter", async () => {
    mockedCreateCompletionWithOpenAI.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }]
    });

    const response = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }]
    });

    expect(mockedCreateCompletionWithOpenAI).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }]
    });
    expect(response.choices[0]?.message.content).toBe("ok");
  });

  test("delegates image generation calls to adapter", async () => {
    mockedGenerateImageWithOpenAI.mockResolvedValueOnce({
      urls: ["https://example.com/image.png"],
      b64Json: []
    });

    const response = await aiClient.images.generate({
      model: "gpt-image-1",
      prompt: "Render a modern loft",
      size: "1024x1024",
      n: 1
    });

    expect(mockedGenerateImageWithOpenAI).toHaveBeenCalledWith({
      model: "gpt-image-1",
      prompt: "Render a modern loft",
      size: "1024x1024",
      n: 1
    });
    expect(response.urls).toEqual(["https://example.com/image.png"]);
  });
});
