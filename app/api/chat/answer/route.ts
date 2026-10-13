import {
  STREAM_TIMEOUT_MS,
  errorMessage,
  getFal,
  hasFalKey,
  noKeyResponse,
  sseResponse,
} from "@/lib/fal";
import type { AnswerRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasFalKey()) return noKeyResponse();
  let body: AnswerRequestBody;
  try {
    body = (await req.json()) as AnswerRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.responseId || !body.inputRequestId || !body.answer) {
    return Response.json({ error: "Missing answer fields." }, { status: 400 });
  }

  const agent = getFal().agent;
  try {
    await agent.responses.answer(
      body.responseId,
      { input_request_id: body.inputRequestId, answer: body.answer },
      { idempotencyKey: body.idempotencyKey, signal: req.signal },
    );
  } catch (err) {
    // Stale or already-answered input: let the client refresh via /resume.
    return Response.json({ error: errorMessage(err) }, { status: 409 });
  }

  return sseResponse(
    agent.responses.stream(body.responseId, {
      signal: req.signal,
      timeoutMs: STREAM_TIMEOUT_MS,
    }),
  );
}
