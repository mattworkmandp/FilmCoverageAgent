/**
 * Shared DTOs between the Next.js API routes and the browser UI.
 * These are plain-JSON projections of the fal Agent SDK types
 * (`AgentResponseView` getters are read explicitly on the server,
 * because JSON.stringify drops them).
 */

export type AttachmentRole = "person" | "location" | "reference";

export interface OutgoingImage {
  url: string;
  role: AttachmentRole;
  name: string;
}

export interface ChatRequestBody {
  text: string;
  images: OutgoingImage[];
  /** Artifact IDs from earlier generations to reuse as references. */
  artifactIds: string[];
  conversationId?: string;
  /** True when this is the first message of a scene (full coverage brief). */
  firstTurn: boolean;
  aspectRatio: "16:9" | "21:9" | "4:3";
}

export interface ArtifactFileDto {
  url: string;
  mimeType: string;
  role: string;
  expiresAt?: string | null;
}

export interface ArtifactDto {
  id: string;
  kind: string;
  mediaType?: string;
  files: ArtifactFileDto[];
  producedBy?: string;
  /** Human label resolved on the server from the producing operation's name. */
  label?: string;
}

export interface OperationDto {
  id: string;
  name: string;
  kind: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  artifactIds: string[];
  error?: string | null;
  progressMessage?: string;
}

export interface PlanStepDto {
  id: string;
  label: string;
  detail?: string;
  endpointId?: string;
  modelPinned?: boolean;
  requiresApproval?: boolean;
}

export interface PlanDto {
  id: string;
  title?: string;
  steps: PlanStepDto[];
}

export interface QuestionDto {
  id: string;
  text: string;
  multiple: boolean;
  allowText: boolean;
  options: Array<{ id: string; label: string; description?: string }>;
}

export type PendingInputDto =
  | {
      id: string;
      kind: "clarification";
      prompt: string;
      questions: QuestionDto[];
    }
  | {
      id: string;
      kind: "approval";
      prompt: string;
      acceptedAnswers: Array<"approve" | "reject">;
    };

export interface CostDto {
  estimated?: number | null;
  settled?: number | null;
  currency?: string;
}

export interface SnapshotDto {
  responseId: string;
  conversationId: string;
  status: string;
  phase: "queued" | "running" | "waiting_for_input" | "cancelling" | "finished";
  sequenceNumber: number;
  outputText: string;
  artifacts: ArtifactDto[];
  operations: OperationDto[];
  plans: PlanDto[];
  /** Fallback text from non-plan blocks the UI doesn't render natively. */
  notices: string[];
  pendingInputs: PendingInputDto[];
  error?: string | null;
  cost?: CostDto | null;
  pendingSubmission?: boolean;
}

export type StreamEvent =
  | { type: "snapshot"; snapshot: SnapshotDto }
  | { type: "error"; message: string }
  | { type: "done" };

export type AgentAnswerBody =
  | {
      kind: "answers";
      answers: Array<{
        question_id: string;
        selected_option_ids: string[];
        text?: string;
      }>;
    }
  | { kind: "approval"; decision: "approve" | "reject" };

export interface AnswerRequestBody {
  responseId: string;
  inputRequestId: string;
  answer: AgentAnswerBody;
  /** Stable per-answer key so a lost ack can be retried without double-applying. */
  idempotencyKey: string;
}
