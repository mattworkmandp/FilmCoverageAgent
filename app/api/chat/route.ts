import type { AgentRequest } from "@fal-ai/client";
import { buildAgentInput } from "@/lib/coverage-prompt";
import { hasFalKey, noKeyResponse, sseResponse, streamNewRun } from "@/lib/fal";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ASPECTS = new Set(["16:9", "21:9", "4:3"]);

function validate(body: Partial<ChatRequestBody>): string | null {
  if (typeof body.text !== "string") return "Missing message text.";
  if (body.text.length > 8000) return "Message is too long (8000 characters max).";
  if (!Array.isArray(body.images) || body.images.length > 12)
    return "Attach at most 12 images per message.";
  if (!Array.isArray(body.artifactIds) || body.artifactIds.length > 8)
    return "Attach at most 8 generated references per message.";
  if (body.aspectRatio && !ASPECTS.has(body.aspectRatio))
    return "Unsupported aspect ratio.";
  return null;
}

export async function POST(req: Request) {
  if (!hasFalKey()) return noKeyResponse();
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const problem = validate(body);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const content = buildAgentInput(body);
  const input: AgentRequest["input"] = [{ role: "user", content }];
  const base = {
    input,
    fal: {
      generation_settings_overrides: {
        preferences: { aspect_ratio: body.aspectRatio ?? "16:9" },
      },
    },
  };
  const request: AgentRequest = body.conversationId
    ? { ...base, conversation: body.conversationId }
    : base;

  return sseResponse(streamNewRun(request, req.signal));
}
