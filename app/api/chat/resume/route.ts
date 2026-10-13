import {
  STREAM_TIMEOUT_MS,
  getFal,
  hasFalKey,
  noKeyResponse,
  sseResponse,
} from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Re-attach to a run that is still executing on fal's side. Used when a
 * Vercel function hit its time limit, the page reloaded, or the SSE
 * connection dropped — server execution is NOT cancelled by disconnects.
 */
export async function POST(req: Request) {
  if (!hasFalKey()) return noKeyResponse();
  let responseId: string;
  try {
    responseId = ((await req.json()) as { responseId: string }).responseId;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!responseId) {
    return Response.json({ error: "Missing responseId." }, { status: 400 });
  }
  return sseResponse(
    getFal().agent.responses.stream(responseId, {
      signal: req.signal,
      timeoutMs: STREAM_TIMEOUT_MS,
    }),
  );
}
