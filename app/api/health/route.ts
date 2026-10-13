import { hasFalKey } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ hasKey: hasFalKey() });
}
