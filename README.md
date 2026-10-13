# Coverage — Dialogue Scene Shot Agent

A dark-mode chat app that turns cast photos + a location photo + a short brief
into a complete **dialogue-scene coverage set**, powered by the
[fal Agent SDK](https://fal.ai/docs/documentation/agent/sdk)
(`@fal-ai/client@1.11.0-alpha.4`).

For each scene the agent:

1. **Blocks** the people naturally into the location and states the axis of
   action and screen directions.
2. Generates a **top-down grey-box overhead diagram** — mannequin figures,
   the dashed axis line, and camera positions C1…Cn with view cones.
3. Designs a **shot list** (wide master, medium two-shot, both
   over-the-shoulders, close-up singles, inserts) that respects the
   **180-degree rule**.
4. Generates **every shot three times**, once per image model, with an
   identical shot description so results are directly comparable:
   **Nano Banana 2.1**, **GPT Image 2.5 Sunburst**, and **Seedream V5 Pro**
   (the agent resolves these names against the live fal catalog).

## Layout

- **Left column — chat.** Drag images anywhere onto it (or paste, or use the
  paperclip). Attachments appear above the prompt in their **native aspect
  ratio** with rounded corners and an **×** to remove them. Tap a thumbnail's
  badge to cycle its role: **Person → Location → Ref** (roles tell the agent
  what each image is; cast are labelled Person A, B, C… in attach order).
- **Right column — coverage board.** Generations grouped per run ("Set 01"),
  overhead diagrams first, then stills ordered by shot number and model so
  the three versions of each shot sit together. Hover a still to view it full
  size, download it, or attach it to your next prompt as a reference for
  revisions ("redo Shot 04 like this one, but tighter").

The agent can pause mid-run to ask a clarifying question or request approval;
those appear as cards in the chat and the run resumes when you answer. Long
runs survive page reloads and Vercel function time limits — the UI saves the
run ID locally and re-attaches to the server-side execution.

Chat history and the board persist in `localStorage` (this browser only).
Generated stills live on fal's CDN and their links can expire, so download
keepers.

## Deploy on Vercel

1. Push this folder to a Git repo and import it in Vercel (or run
   `npx vercel` in the folder). Framework preset: **Next.js** (auto-detected).
2. Set the environment variable **`FAL_KEY`** (Project Settings →
   Environment Variables). Create the key at
   [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) with the **AGENT**
   permission preset — Agent SDK calls fail without it.
3. Make sure the project's Node.js version is **22 or later** (Project
   Settings → General → Node.js Version). The repo's `engines` field
   requests it.
4. Deploy. Anyone with the URL can generate on your fal account — this build
   intentionally has no login. Put Vercel deployment protection or a password
   in front of it before sharing the link widely.

`vercel.json` raises API route duration to 300s; the client automatically
reconnects to runs that take longer, so multi-model coverage sets complete
even on the Hobby plan.

### Optional model pins

If the agent picks a neighboring catalog variant instead of the exact model
you want, set endpoint IDs and they will be passed to the agent as explicit
pins:

| Env var | Model |
| --- | --- |
| `FAL_MODEL_BANANA` | Nano Banana 2.1 |
| `FAL_MODEL_GPT` | GPT Image 2.5 Sunburst |
| `FAL_MODEL_SEEDREAM` | Seedream V5 Pro |

## Run locally

```bash
cp .env.example .env.local   # then paste your FAL_KEY
npm install
npm run dev                  # http://localhost:3000
```

Production mode: `npm run build && npm run start`.

## How it works

- Browser uploads each dragged image through `/api/upload` to **fal storage**
  (server-side; the key never reaches the browser), then sends the brief to
  `/api/chat`.
- `/api/chat` builds a structured cinematography brief
  ([lib/coverage-prompt.ts](lib/coverage-prompt.ts)) — cast/location roles,
  blocking + axis instructions, diagram spec, shot-list requirements, the
  three pinned models, and a naming convention (`SHOT 03 — CU PERSON A —
  Nano Banana 2.1`) — and streams `agent.stream()` snapshots back as SSE.
- Snapshots are projected to plain JSON on the server
  ([lib/fal.ts](lib/fal.ts)); artifact labels come from the producing
  operation's name, and the board derives shot number / model / diagram-ness
  from that label ([lib/models.ts](lib/models.ts)).
- `/api/chat/answer` submits clarification/approval answers with a stable
  idempotency key and resumes streaming; `/api/chat/resume` re-attaches to a
  running response; `/api/chat/cancel` requests cancellation.
- Aspect ratio (16:9 / 21:9 / 4:3) is sent as a generation-settings
  override; if the account lacks that feature the server retries once
  without overrides so generation still works.

## Notes

- Media generation is billed to the fal account behind `FAL_KEY`. A typical
  set (1 diagram + 6–9 shots × 3 models) is 19–28 image generations.
- The Agent SDK is in alpha; the pinned version is `1.11.0-alpha.4`, the one
  the current docs describe.
