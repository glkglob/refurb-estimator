/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextDecoder, TextEncoder } from "util";
import { ReadableStream, TransformStream, WritableStream } from "stream/web";
import NewBuildPage from "./page";
import { calculateNewBuild } from "@/lib/newBuildEstimator";
import { aiClient } from "@/lib/ai/client";
import { PropertyType } from "@/lib/propertyType";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() })
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() })
}));

jest.mock("@/components/TermTooltip", () => ({
  __esModule: true,
  default: ({ term }: { term: string }) => <>{term}</>
}));

jest.mock("@/lib/ai/client", () => ({
  aiClient: {
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }
}));

type MockedCreateFn = jest.MockedFunction<typeof aiClient.chat.completions.create>;
const mockedCreate = aiClient.chat.completions.create as MockedCreateFn;
type AssistantChatPostHandler = (request: Request) => Promise<Response>;

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

function formatCurrency(value: number): string {
  return gbp.format(value);
}

describe("NewBuildPage assistant journey", () => {
  let originalFetch: typeof fetch;
  let assistantChatPost: AssistantChatPostHandler;
  let consoleWarnSpy: jest.SpyInstance;
  let lastAssistantBody = "";

  beforeEach(async () => {
    globalThis.TextEncoder = TextEncoder as typeof TextEncoder;
    globalThis.TextDecoder = TextDecoder as typeof TextDecoder;
    globalThis.ReadableStream = ReadableStream as unknown as typeof globalThis.ReadableStream;
    globalThis.WritableStream = WritableStream as unknown as typeof globalThis.WritableStream;
    globalThis.TransformStream = TransformStream as unknown as typeof globalThis.TransformStream;

    const fetchPrimitives = await import("next/dist/compiled/@edge-runtime/primitives/fetch");
    globalThis.Request = fetchPrimitives.Request as typeof Request;
    globalThis.Response = fetchPrimitives.Response as typeof Response;
    globalThis.Headers = fetchPrimitives.Headers as typeof Headers;

    const routeModule = await import("@/app/api/v1/assistant/chat/route");
    assistantChatPost = routeModule.POST;

    mockedCreate.mockReset();
    originalFetch = global.fetch;
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
    lastAssistantBody = "";

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/assistant/chat")) {
        const request = new Request("http://localhost/api/v1/assistant/chat", {
          method: init?.method ?? "GET",
          headers: init?.headers,
          body: init?.body ?? null
        });

        const routeResponse = await assistantChatPost(request);
        let bodyText = "";
        try {
          const payload = await routeResponse.json();
          bodyText = JSON.stringify(payload);
        } catch {
          bodyText = await routeResponse.text();
        }
        lastAssistantBody = bodyText;
        return new Response(bodyText, {
          status: routeResponse.status,
          headers: routeResponse.headers
        });
      }

      return new Response("Not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    consoleWarnSpy.mockRestore();
  });

  test("applies sanitized editor actions and recalculates when user asks for a cheaper resale-safe option", async () => {
    const standardInput = {
      propertyType: PropertyType.DETACHED_HOUSE,
      spec: "standard",
      totalAreaM2: 120,
      bedrooms: 3,
      storeys: 2,
      postcodeDistrict: "LS1",
      garage: false,
      renewableEnergy: false,
      basementIncluded: false
    } as const;

    const labourTypical = 275;
    const standardTotal = calculateNewBuild(standardInput).totalTypical + labourTypical;
    const basicTotal = calculateNewBuild({ ...standardInput, spec: "basic" }).totalTypical + labourTypical;
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply:
                "To reduce cost while preserving resale potential, I lowered the spec one step.",
              actions: [
                {
                  type: "update_fields",
                  fields: {
                    spec: "basic",
                    unsupportedField: "drop-this"
                  }
                }
              ]
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const user = userEvent.setup();
    render(<NewBuildPage />);

    await user.type(screen.getByLabelText(/Postcode district/i), "LS1");
    await user.click(screen.getByRole("button", { name: /Calculate estimate/i }));

    expect(await screen.findByText("Project details")).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(standardTotal))).toBeInTheDocument();
    expect(screen.getByText(/Specification:/i).closest("div")).toHaveTextContent("standard");

    await user.type(
      screen.getByPlaceholderText(/ask a question about this estimate/i),
      "Make this cheaper but keep resale strong"
    );
    await user.click(screen.getByRole("button", { name: /Ask assistant/i }));

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledTimes(1);
    });

    expect(lastAssistantBody.length).toBeGreaterThan(0);
    expect(JSON.parse(lastAssistantBody)).toEqual(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            type: "update_fields",
            fields: expect.objectContaining({
              spec: "basic"
            })
          })
        ])
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/Specification:/i).closest("div")).toHaveTextContent("basic");
      expect(screen.getByText(formatCurrency(basicTotal))).toBeInTheDocument();
    });
  });
});
