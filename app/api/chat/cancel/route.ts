import {
  errorMessage,
  getFal,
  hasFalKey,
  noKeyResponse,
  toSnapshotDto,
} from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
  try {
    const view = await getFal().agent.responses.cancel(responseId, {
      signal: req.signal,
    });
    return Response.json({ snapshot: toSnapshotDto(view) });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
