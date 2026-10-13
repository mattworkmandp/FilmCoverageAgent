import {
  createFalClient,
  type AgentArtifact,
  type AgentBlock,
  type AgentInputRequest,
  type AgentOperation,
  type AgentRequest,
  type AgentResponseView,
  type FalClient,
} from "@fal-ai/client";
import type {
  ArtifactDto,
  OperationDto,
  PendingInputDto,
  PlanDto,
  SnapshotDto,
  StreamEvent,
} from "./types";

export const STREAM_TIMEOUT_MS = 280_000;

export function hasFalKey(): boolean {
  return Boolean(process.env.FAL_KEY && process.env.FAL_KEY.trim().length > 0);
}

let cached: FalClient | null = null;

export function getFal(): FalClient {
  if (!cached) {
    cached = createFalClient({
      credentials: process.env.FAL_KEY,
      retry: { maxRetries: 3 },
    });
  }
  return cached;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function mapPendingInput(input: AgentInputRequest): PendingInputDto {
  if (input.kind === "clarification") {
    return {
      id: input.id,
      kind: "clarification",
      prompt: input.prompt,
      questions: input.questions.map((q) => ({
        id: q.id,
        text: q.text,
        multiple: q.multiple,
        allowText: q.allow_text,
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
        })),
      })),
    };
  }
  return {
    id: input.id,
    kind: "approval",
    prompt: input.prompt,
    acceptedAnswers: input.accepted_answers?.length
      ? input.accepted_answers
      : ["approve", "reject"],
  };
}

function extractPlansAndNotices(view: AgentResponseView, outputText: string) {
  const plans: PlanDto[] = [];
  const notices: string[] = [];
  for (const item of view.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if ((part as AgentBlock).type !== "fal.block") continue;
      const block = part as AgentBlock;
      if (block.kind === "plan") {
        const data = block.data as {
          title?: string;
          steps?: Array<{
            id: string;
            label: string;
            detail?: string;
            endpoint_id?: string;
            model_pinned?: boolean;
            requires_approval?: boolean;
          }>;
        } | null;
        plans.push({
          id: block.id,
          title: data?.title,
          steps: (data?.steps ?? []).map((s) => ({
            id: s.id,
            label: s.label,
            detail: s.detail,
            endpointId: s.endpoint_id,
            modelPinned: s.model_pinned,
            requiresApproval: s.requires_approval,
          })),
        });
      } else if (block.fallback_text && !outputText.includes(block.fallback_text)) {
        notices.push(block.fallback_text);
      }
    }
  }
  return { plans, notices };
}

export function toSnapshotDto(view: AgentResponseView): SnapshotDto {
  // Derived views are getters that JSON.stringify omits — read them explicitly.
  const outputText = view.output_text ?? "";
  const rawArtifacts: AgentArtifact[] = view.artifacts ?? [];
  const rawPending: AgentInputRequest[] = view.pending_inputs ?? [];

  const operations: OperationDto[] = [];
  const opNameById = new Map<string, string>();
  const opNameByArtifactId = new Map<string, string>();
  for (const item of view.output) {
    if (item.type !== "fal.operation") continue;
    const op = item as AgentOperation;
    opNameById.set(op.id, op.name);
    for (const aid of op.artifact_ids ?? []) opNameByArtifactId.set(aid, op.name);
    operations.push({
      id: op.id,
      name: op.name,
      kind: op.kind,
      status: op.status,
      artifactIds: op.artifact_ids ?? [],
      error: op.error ? op.error.message : null,
      progressMessage: op.progress?.message,
    });
  }

  const artifacts: ArtifactDto[] = rawArtifacts.map((a) => ({
    id: a.id,
    kind: a.kind,
    mediaType: a.media_type,
    producedBy: a.produced_by,
    label:
      (a.produced_by ? opNameById.get(a.produced_by) : undefined) ??
      opNameByArtifactId.get(a.id),
    files: (a.files ?? []).map((f) => ({
      url: f.url,
      mimeType: f.mime_type,
      role: f.role,
      expiresAt: f.url_expires_at ?? null,
    })),
  }));

  const { plans, notices } = extractPlansAndNotices(view, outputText);
  const cost = view.usage?.cost;

  return {
    responseId: view.id,
    conversationId: view.fal.conversation_id,
    status: view.status,
    phase: view.fal.phase,
    sequenceNumber: view.fal.sequence_number,
    outputText,
    artifacts,
    operations,
    plans,
    notices,
    pendingInputs: rawPending
      .filter((p) => p.status === "pending")
      .map(mapPendingInput),
    error: view.error ? view.error.message : null,
    cost: cost
      ? { estimated: cost.estimated, settled: cost.settled, currency: cost.currency }
      : null,
    pendingSubmission: Boolean(view.fal.pending_submission),
  };
}

/**
 * Stream a new agent run. Generation-settings overrides need feature access;
 * if the create is rejected before any snapshot arrives, retry once without
 * them so the app still works on accounts without that access.
 */
export async function* streamNewRun(
  request: AgentRequest,
  signal?: AbortSignal,
): AsyncGenerator<AgentResponseView> {
  const agent = getFal().agent;
  const attempts: AgentRequest[] = [request];
  if (request.fal?.generation_settings_overrides || request.fal?.generation_settings) {
    const { fal: _fal, ...rest } = request;
    attempts.push(rest as AgentRequest);
  }
  for (let i = 0; i < attempts.length; i++) {
    let yielded = false;
    try {
      for await (const view of agent.stream(attempts[i], {
        signal,
        timeoutMs: STREAM_TIMEOUT_MS,
      })) {
        yielded = true;
        yield view;
      }
      return;
    } catch (err) {
      if (!yielded && i < attempts.length - 1) continue;
      throw err;
    }
  }
}

export function sseResponse(
  source: AsyncIterable<AgentResponseView>,
): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* controller closed */
        }
      }, 15_000);
      try {
        for await (const view of source) {
          send({ type: "snapshot", snapshot: toSnapshotDto(view) });
        }
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function noKeyResponse(): Response {
  return Response.json(
    {
      error:
        "FAL_KEY is not set on the server. Add a fal API key with the AGENT permission preset as the FAL_KEY environment variable (Vercel: Project Settings → Environment Variables), then redeploy.",
    },
    { status: 400 },
  );
}
