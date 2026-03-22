import { NextResponse } from "next/server";
import { z } from "zod";

type AgentAction = Record<string, unknown>;

type AgentResult = {
  output: string;
  actions: AgentAction[];
  logs: string[];
};

const agentRequestSchema = z.object({
  message: z.unknown(),
  state: z.unknown().optional()
});
type AgentRequest = {
  message: string;
  state?: unknown;
};

async function executeAgent(payload: AgentRequest): Promise<AgentResult> {
  // TODO: replace with your real agent executor invocation.
  return {
    output: `AI response to: ${payload.message}`,
    actions: [],
    logs: []
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = agentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const normalizedMessage =
      typeof parsed.data.message === "string" ? parsed.data.message.trim() : "";

    if (normalizedMessage.length === 0) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: ["message is required"]
        },
        { status: 400 }
      );
    }

    const result = await executeAgent({
      message: normalizedMessage,
      state: parsed.data.state
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/agent/execute failed", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
