import { errorMessage, getFal, hasFalKey, noKeyResponse } from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  if (!hasFalKey()) return noKeyResponse();
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: `"${file.name}" is not an image (${file.type || "unknown type"}).` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: `"${file.name}" is larger than 25 MB.` },
        { status: 400 },
      );
    }
    const url = await getFal().storage.upload(file);
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
