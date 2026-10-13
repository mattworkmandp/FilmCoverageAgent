import type { AgentInputContent } from "@fal-ai/client";
import { COMPARE_MODELS } from "./models";
import type { ChatRequestBody } from "./types";

const PERSON_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function modelList(): string {
  return COMPARE_MODELS.map((m, i) => {
    const endpoint = process.env[m.envVar];
    const pin = endpoint ? ` — use endpoint \`${endpoint}\`` : "";
    return `${i + 1}. **${m.name}** (${m.hint})${pin}`;
  }).join("\n");
}

function castAndLocation(body: ChatRequestBody): string {
  const lines: string[] = [];
  let personIndex = 0;
  let locationIndex = 0;
  body.images.forEach((img, i) => {
    const n = i + 1;
    if (img.role === "person") {
      const letter = PERSON_LETTERS[personIndex++] ?? `${personIndex}`;
      lines.push(
        `- Image ${n} ("${img.name}") = PERSON ${letter}, a character in the scene. Preserve this person's face, hair, body type and wardrobe exactly in every generation.`,
      );
    } else if (img.role === "location") {
      locationIndex += 1;
      const tag = locationIndex === 1 ? "THE LOCATION" : `LOCATION REFERENCE ${locationIndex}`;
      lines.push(
        `- Image ${n} ("${img.name}") = ${tag}. Preserve its architecture, furniture, props, practical lights and light direction in every generation.`,
      );
    } else {
      lines.push(
        `- Image ${n} ("${img.name}") = visual reference (mood / wardrobe / prop / framing). Use it as guidance, not as a character.`,
      );
    }
  });
  if (body.artifactIds.length > 0) {
    lines.push(
      `- ${body.artifactIds.length} previously generated image(s) are attached as artifacts. Treat them as approved references for identity, blocking and look continuity.`,
    );
  }
  if (lines.length === 0) {
    lines.push(
      "- No reference images were attached. Invent cast and location from the brief below and keep them consistent across every shot.",
    );
  }
  return lines.join("\n");
}

function firstTurnBrief(body: ChatRequestBody): string {
  const userText = body.text.trim() || "(No written brief — design a natural two-person dialogue scene from the images alone.)";
  return `You are the coverage planner and stills generator for a film dialogue scene. Your deliverable is a complete, shootable COVERAGE SET: blocked stills of the same moment from every camera angle an editor needs, plus overhead diagrams that explain the setup.

ATTACHED IMAGES (in order):
${castAndLocation(body)}

DIRECTOR'S BRIEF:
${userText}

WORK IN THIS ORDER:

1. BLOCKING. Place the people naturally in the location for a dialogue scene — believable positions, posture and eyelines motivated by the space (seated/standing, distance, who faces whom, hands and props). In your text, briefly state: where each person is, the AXIS OF ACTION (the line between the two principal characters), which side of the line all cameras stay on, and the resulting screen directions (e.g. "PERSON A frame-left looking camera-right; PERSON B frame-right looking camera-left"). Every shot below must respect the 180-degree rule: never cross the axis, keep eyelines and screen direction consistent so the shots cut together.

2. OVERHEAD BLOCKING DIAGRAM. Generate ONE top-down overhead diagram of the setup (one per distinct blocking setup if the brief moves people): flat grey-box mannequin figures viewed from directly above on a simple floor plan of the location (walls, key furniture, windows/doors as simple shapes). Label each figure with its person letter, draw the axis of action as a dashed line through the two principal characters, and mark every camera position C1, C2, C3… with a small camera icon and its field-of-view cone, numbered to match the shot list in step 3. Clean technical-diagram look: neutral greys on white/off-white, legible labels, no photorealism. Generate the diagram once, with ${COMPARE_MODELS[0].name}.

3. SHOT LIST. Design the coverage, numbered SHOT 01, SHOT 02, … Cover at minimum: a wide MASTER that geography-locks the whole blocking; a medium TWO-SHOT; over-the-shoulder shots in both directions; and a clean CLOSE-UP single for each principal character. Add inserts, reactions or a profile two-shot when the brief motivates them (aim for 6–9 shots total unless the brief says otherwise). For each shot state: size (WS/MS/MCU/CU/OTS/insert), subject(s), camera position matching its C-number on the diagram, approximate lens feel (wide shots 24–35mm deep focus; mediums 35–50mm; close-ups 85mm shallow depth of field), and who looks which way.

4. GENERATE EVERY SHOT THREE TIMES — once with each of these image models, pinning/selecting the named model for each generation (closest catalog match if a name has variants):
${modelList()}
Use the identical shot description for all three versions of a shot so the results are directly comparable: same framing, same blocking, same wardrobe, same lighting, same moment. Feed the character and location reference images into every generation so identity and geography stay consistent. Photorealistic cinematic stills, aspect ratio ${body.aspectRatio}, natural motivated lighting consistent across the whole set. Name each generation so it is identifiable, in the form "SHOT 03 — CU PERSON A — ${COMPARE_MODELS[0].name}" (and likewise for the other models; name the diagram "DIAGRAM — Overhead blocking, Setup 1").

5. MANIFEST. In your reply text, after the shot list, print one line per generated image exactly in that same form (SHOT NN — description — model name / DIAGRAM — …), then finish with 2–3 short continuity notes (axis side, eyelines, light direction) an editor should know. Keep all prose tight — the images are the deliverable.

If one essential fact is genuinely ambiguous (for example which attached person plays which role in the brief), ask one short clarifying question instead of guessing; otherwise proceed without asking.`;
}

function followUpBrief(body: ChatRequestBody): string {
  const userText = body.text.trim() || "Continue.";
  const attachNote =
    body.images.length > 0 || body.artifactIds.length > 0
      ? `\n\nNEW ATTACHMENTS (in order):\n${castAndLocation(body)}`
      : "";
  return `${userText}${attachNote}

Continuity rules for this revision: keep the established blocking, axis of action, screen directions, wardrobe and lighting unless I explicitly ask to change them. Any new or redone shot still gets generated three times — once each with ${COMPARE_MODELS.map((m) => m.name).join(", ")} — using an identical shot description across models, named "SHOT NN — description — model name" (reuse the original shot number when redoing a shot). If the blocking changes, generate a fresh overhead grey-box diagram for the new setup. Aspect ratio ${body.aspectRatio}. End your reply with the manifest lines for the new images.`;
}

export function buildAgentInput(body: ChatRequestBody): AgentInputContent[] {
  const text = body.firstTurn ? firstTurnBrief(body) : followUpBrief(body);
  const content: AgentInputContent[] = [{ type: "input_text", text }];
  for (const img of body.images) {
    content.push({ type: "input_image", image_url: img.url });
  }
  for (const artifactId of body.artifactIds) {
    content.push({ type: "fal.input_artifact", artifact_id: artifactId });
  }
  return content;
}
