/**
 * The three image models every shot is compared across.
 * The fal Agent resolves these names against the live model catalog.
 * If you know exact endpoint IDs, set FAL_MODEL_BANANA / FAL_MODEL_GPT /
 * FAL_MODEL_SEEDREAM in the environment and they will be passed to the
 * agent as explicit pins (server-side prompt building only).
 */

export type CompareModelId = "banana" | "gpt" | "seedream";

export interface CompareModel {
  id: CompareModelId;
  /** Display name used in the UI and the agent brief. */
  name: string;
  /** Short badge label. */
  short: string;
  /** Extra catalog hints so the agent resolves the right endpoint. */
  hint: string;
  /** Tailwind-safe hex used for the model dot in the gallery. */
  dot: string;
  envVar: string;
}

export const COMPARE_MODELS: CompareModel[] = [
  {
    id: "banana",
    name: "Nano Banana 2.1",
    short: "Banana 2.1",
    hint: "Google's Gemini native image generation/editing model (also written \"Nana Banana 2.1\")",
    dot: "#f5c542",
    envVar: "FAL_MODEL_BANANA",
  },
  {
    id: "gpt",
    name: "GPT Image 2.5 Sunburst",
    short: "GPT 2.5",
    hint: "OpenAI's GPT Image model, the \"Sunburst\" release",
    dot: "#34d399",
    envVar: "FAL_MODEL_GPT",
  },
  {
    id: "seedream",
    name: "Seedream V5 Pro",
    short: "Seedream V5",
    hint: "ByteDance's Seedream image model, V5 Pro tier",
    dot: "#fb7185",
    envVar: "FAL_MODEL_SEEDREAM",
  },
];

export function detectModel(text: string | undefined | null): CompareModelId | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("banana") || t.includes("gemini")) return "banana";
  if (t.includes("seedream") || t.includes("seed dream") || t.includes("bytedance")) return "seedream";
  if (t.includes("gpt") || t.includes("sunburst") || t.includes("openai")) return "gpt";
  return null;
}

export function modelById(id: CompareModelId | null): CompareModel | null {
  if (!id) return null;
  return COMPARE_MODELS.find((m) => m.id === id) ?? null;
}

export function isDiagramLabel(text: string | undefined | null): boolean {
  if (!text) return false;
  return /diagram|overhead|floor\s?plan|top[- ]?down|blocking\s(map|diagram|plan)|camera\s(plot|map)/i.test(text);
}

export function shotNumber(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/shot\s*#?\s*0*(\d+)/i) || text.match(/\bC(\d{1,2})\b/);
  return m ? parseInt(m[1], 10) : null;
}
