"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatThumb,
  LiveState,
} from "@/hooks/useAgentChat";
import type { AgentAnswerBody, PendingInputDto, PlanDto } from "@/lib/types";
import AgentText from "./AgentText";
import { AlertIcon, CameraIcon, CheckIcon, Spinner, XIcon } from "./icons";

const EXAMPLES = [
  "Two-hander at the kitchen table, morning light through the window. She has just told him she is leaving. Tense and quiet — coverage for the whole conversation.",
  "A detective interviews a nervous witness in a diner booth at night, rain on the windows, neon glow. Classic noir coverage.",
];

function phaseLabel(phase: string, status: string): string {
  if (phase === "queued" || status === "queued") return "Queued on fal…";
  if (phase === "waiting_for_input") return "Waiting for your answer";
  if (phase === "cancelling") return "Cancelling…";
  return "Planning & generating…";
}

function UserThumbs({ thumbs }: { thumbs: ChatThumb[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {thumbs.map((t, i) => {
        const h = 52;
        const w =
          t.width && t.height
            ? Math.round(Math.min(96, Math.max(32, h * (t.width / t.height))))
            : 52;
        return (
          <div key={i} className="relative overflow-hidden rounded-md border border-white/15" style={{ height: h, width: w }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.url} alt={t.name} className="h-full w-full object-cover" />
            <span
              className={`absolute bottom-0.5 left-0.5 rounded px-1 py-px font-mono text-[8px] font-medium uppercase ${
                t.role === "location"
                  ? "bg-tungsten text-black"
                  : t.role === "person"
                    ? "bg-sky-400 text-black"
                    : "bg-zinc-700 text-zinc-100"
              }`}
            >
              {t.role}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanDto }) {
  if (plan.steps.length === 0) return null;
  return (
    <div className="my-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-tungsten">
        {plan.title || "Generation plan"}
      </div>
      <ol className="space-y-1">
        {plan.steps.map((s, i) => (
          <li key={s.id || i} className="flex items-baseline gap-2 text-[12.5px] text-zinc-300">
            <span className="shrink-0 font-mono text-[10px] text-zinc-500">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              {s.label}
              {s.detail ? <span className="text-zinc-500"> — {s.detail}</span> : null}
              {s.endpointId ? (
                <span className="ml-1.5 rounded bg-white/10 px-1 py-px font-mono text-[9px] text-zinc-300">
                  {s.endpointId}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ClarificationCard({
  pending,
  disabled,
  onAnswer,
}: {
  pending: Extract<PendingInputDto, { kind: "clarification" }>;
  disabled: boolean;
  onAnswer: (p: PendingInputDto, a: AgentAnswerBody) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});

  const toggle = (qid: string, oid: string, multiple: boolean) => {
    setSelected((prev) => {
      const cur = prev[qid] ?? [];
      if (multiple) {
        return { ...prev, [qid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
      }
      return { ...prev, [qid]: cur.includes(oid) ? [] : [oid] };
    });
  };

  const complete = pending.questions.every(
    (q) => (selected[q.id]?.length ?? 0) > 0 || (texts[q.id] ?? "").trim().length > 0,
  );

  const submit = () => {
    onAnswer(pending, {
      kind: "answers",
      answers: pending.questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: selected[q.id] ?? [],
        ...((texts[q.id] ?? "").trim() ? { text: texts[q.id].trim() } : {}),
      })),
    });
  };

  return (
    <div className="rounded-xl border border-tungsten/40 bg-tungsten/[0.06] px-3.5 py-3">
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-tungsten">
        The agent needs your call
      </div>
      {pending.prompt && <p className="mb-2 text-[13px] text-zinc-200">{pending.prompt}</p>}
      {pending.questions.map((q) => (
        <div key={q.id} className="mb-3 last:mb-1">
          <div className="mb-1.5 text-[13px] font-medium text-zinc-100">{q.text}</div>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => {
              const active = (selected[q.id] ?? []).includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(q.id, o.id, q.multiple)}
                  title={o.description}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                    active
                      ? "border-tungsten bg-tungsten font-medium text-black"
                      : "border-white/20 bg-white/[0.04] text-zinc-200 hover:border-white/40"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {q.allowText && (
            <input
              value={texts[q.id] ?? ""}
              onChange={(e) => setTexts((p) => ({ ...p, [q.id]: e.target.value }))}
              placeholder="Or type your own answer…"
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-tungsten/60"
            />
          )}
        </div>
      ))}
      <button
        type="button"
        disabled={disabled || !complete}
        onClick={submit}
        className="mt-1 rounded-lg bg-tungsten px-3 py-1.5 text-[12.5px] font-semibold text-black transition enabled:hover:bg-[#f0b654] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue generation
      </button>
    </div>
  );
}

function ApprovalCard({
  pending,
  disabled,
  onAnswer,
}: {
  pending: Extract<PendingInputDto, { kind: "approval" }>;
  disabled: boolean;
  onAnswer: (p: PendingInputDto, a: AgentAnswerBody) => void;
}) {
  return (
    <div className="rounded-xl border border-tungsten/40 bg-tungsten/[0.06] px-3.5 py-3">
      <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-tungsten">
        Approval requested
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-zinc-200">
        {pending.prompt || "The agent wants your approval before continuing."}
      </p>
      <div className="flex gap-2">
        {pending.acceptedAnswers.includes("approve") && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(pending, { kind: "approval", decision: "approve" })}
            className="flex items-center gap-1.5 rounded-lg bg-tungsten px-3 py-1.5 text-[12.5px] font-semibold text-black transition enabled:hover:bg-[#f0b654] disabled:opacity-40"
          >
            <CheckIcon width={13} height={13} /> Approve
          </button>
        )}
        {pending.acceptedAnswers.includes("reject") && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(pending, { kind: "approval", decision: "reject" })}
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 transition enabled:hover:bg-white/10 disabled:opacity-40"
          >
            <XIcon width={13} height={13} /> Reject
          </button>
        )}
      </div>
    </div>
  );
}

function LiveStatus({ live, busy }: { live: LiveState; busy: boolean }) {
  const ops = live.operations;
  const active = ops.filter((o) => o.status === "in_progress" || o.status === "queued");
  const failed = ops.filter((o) => o.status === "failed");
  const doneCount = ops.filter((o) => o.status === "completed").length;
  if (!busy && active.length === 0 && failed.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[12.5px] text-zinc-200">
        {busy ? <Spinner /> : <span className="h-2 w-2 rounded-full bg-zinc-500" />}
        <span>{phaseLabel(live.phase, live.status)}</span>
        {ops.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-zinc-500">
            {doneCount}/{ops.length} generations
          </span>
        )}
      </div>
      {active.length > 0 && (
        <ul className="mt-2 space-y-1">
          {active.slice(0, 6).map((o) => (
            <li key={o.id} className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
              <CameraIcon width={12} height={12} className="shrink-0 text-tungsten/80" />
              <span className="truncate">{o.name}</span>
              {o.progressMessage && <span className="truncate text-zinc-600">{o.progressMessage}</span>}
            </li>
          ))}
          {active.length > 6 && (
            <li className="font-mono text-[11px] text-zinc-600">+{active.length - 6} more in queue…</li>
          )}
        </ul>
      )}
      {failed.map((o) => (
        <div key={o.id} className="mt-1.5 flex items-start gap-2 text-[11.5px] text-red-300/90">
          <AlertIcon width={13} height={13} className="mt-px shrink-0" />
          <span>
            {o.name}
            {o.error ? <span className="text-red-300/60"> — {o.error}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatCost(m: ChatMessage): string | null {
  const c = m.cost;
  if (!c) return null;
  const v = c.settled ?? c.estimated;
  if (typeof v !== "number") return null;
  return `≈ $${v.toFixed(2)}${c.settled != null ? "" : " est."}`;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  live: LiveState;
  busy: boolean;
  hasKey: boolean | null;
  onAnswer: (p: PendingInputDto, a: AgentAnswerBody) => void;
  onReconnect: () => void;
  onPickExample: (text: string) => void;
}

export default function ChatPanel({
  messages,
  live,
  busy,
  hasKey,
  onAnswer,
  onReconnect,
  onPickExample,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, live, busy]);

  const disconnected =
    !busy &&
    live.responseId &&
    (live.phase === "running" || live.phase === "queued") &&
    live.pendingInputs.length === 0;

  const lastAgentId = [...messages].reverse().find((m) => m.role === "agent")?.id;

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      }}
      className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      {hasKey === false && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-200/90">
          <span className="font-medium text-amber-100">No fal key on the server.</span>{" "}
          Create a key with the <span className="font-mono">AGENT</span> preset at
          fal.ai/dashboard/keys, set it as <span className="font-mono">FAL_KEY</span> (on
          Vercel: Project Settings → Environment Variables), then redeploy or restart.
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-2">
          <p className="text-[14px] leading-relaxed text-zinc-300">
            Drop in photos of your <span className="text-zinc-100">cast</span> and one{" "}
            <span className="text-zinc-100">location</span>, describe the dialogue scene, and
            the agent blocks it, draws an overhead camera plot, and generates the full
            coverage set — every shot three ways, one per model.
          </p>
          <ol className="mt-4 space-y-2 text-[12.5px] text-zinc-400">
            <li className="flex gap-2.5">
              <span className="font-mono text-tungsten">1</span> Drag cast photos + a location
              photo onto this panel. Tap a badge to mark the location.
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono text-tungsten">2</span> Write the scene: who talks,
              the mood, any beats or props that matter.
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono text-tungsten">3</span> Generate. Diagrams land with
              the stills on the board; refine any shot by chatting.
            </li>
          </ol>
          <div className="mt-5 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
              Try a brief
            </div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onPickExample(ex)}
                className="block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[12.5px] leading-relaxed text-zinc-300 transition hover:border-tungsten/50 hover:text-zinc-100"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {messages.map((m) => {
          if (m.role === "system") {
            return (
              <div
                key={m.id}
                className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-red-200/90"
              >
                <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
                <span>{m.text}</span>
              </div>
            );
          }
          if (m.role === "user") {
            return (
              <div key={m.id}>
                <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-sky-300/80">
                  You · Director
                </div>
                {m.thumbnails && m.thumbnails.length > 0 && <UserThumbs thumbs={m.thumbnails} />}
                {m.text.trim() && (
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-100">{m.text}</p>
                )}
              </div>
            );
          }
          const streaming = !m.done && m.id === lastAgentId && busy;
          const cost = formatCost(m);
          return (
            <div key={m.id}>
              <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-tungsten">
                Coverage agent
              </div>
              {m.text.trim() ? (
                <div className={streaming ? "caret" : undefined}>
                  <AgentText text={m.text} />
                </div>
              ) : (
                !m.error && <p className="text-[13px] text-zinc-500">Thinking through the blocking…</p>
              )}
              {(m.plans ?? []).map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
              {(m.notices ?? []).map((n, i) => (
                <p key={i} className="mt-2 whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-zinc-500">
                  {n}
                </p>
              ))}
              {m.error && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[12.5px] text-red-200/90">
                  <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
                  <span>{m.error}</span>
                </div>
              )}
              {cost && m.done && (
                <div className="mt-1.5 font-mono text-[10px] text-zinc-600">run cost {cost}</div>
              )}
            </div>
          );
        })}

        <LiveStatus live={live} busy={busy} />

        {live.pendingInputs.map((p) =>
          p.kind === "clarification" ? (
            <ClarificationCard key={p.id} pending={p} disabled={busy} onAnswer={onAnswer} />
          ) : (
            <ApprovalCard key={p.id} pending={p} disabled={busy} onAnswer={onAnswer} />
          ),
        )}

        {disconnected && (
          <div className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[12.5px] text-zinc-300">
            Live updates paused — the run is still executing on fal&apos;s side.{" "}
            <button
              type="button"
              onClick={onReconnect}
              className="font-medium text-tungsten underline decoration-tungsten/40 underline-offset-2 hover:decoration-tungsten"
            >
              Reconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
