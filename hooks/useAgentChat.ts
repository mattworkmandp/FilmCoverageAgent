"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectModel,
  isDiagramLabel,
  shotNumber,
  type CompareModelId,
} from "@/lib/models";
import type {
  AgentAnswerBody,
  ArtifactDto,
  AttachmentRole,
  CostDto,
  OperationDto,
  PendingInputDto,
  PlanDto,
  SnapshotDto,
  StreamEvent,
} from "@/lib/types";

export interface Attachment {
  id: string;
  kind: "image" | "artifact";
  name: string;
  previewUrl: string;
  width?: number;
  height?: number;
  role: AttachmentRole;
  upload: "uploading" | "ready" | "error";
  url?: string;
  artifactId?: string;
  error?: string;
}

export interface ChatThumb {
  url: string;
  name: string;
  role: AttachmentRole;
  width?: number;
  height?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  thumbnails?: ChatThumb[];
  responseId?: string;
  plans?: PlanDto[];
  notices?: string[];
  cost?: CostDto | null;
  done?: boolean;
  error?: string | null;
}

export interface GalleryItem {
  id: string;
  responseId: string;
  label?: string;
  model: CompareModelId | null;
  isDiagram: boolean;
  shot: number | null;
  imageUrl: string;
  mimeType: string;
}

export interface LiveState {
  responseId: string | null;
  status: string;
  phase: string;
  operations: OperationDto[];
  pendingInputs: PendingInputDto[];
}

const STORAGE_KEY = "coverage-agent-v1";
const TERMINAL = new Set(["completed", "incomplete", "failed", "cancelled"]);
const MAX_RESUMES = 40;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function isStopped(snap: SnapshotDto): boolean {
  return (
    TERMINAL.has(snap.status) ||
    snap.phase === "waiting_for_input" ||
    Boolean(snap.pendingSubmission)
  );
}

function galleryItemFrom(dto: ArtifactDto, responseId: string): GalleryItem | null {
  const file =
    dto.files.find((f) => f.mimeType?.startsWith("image/")) ?? dto.files[0];
  if (!file?.url) return null;
  return {
    id: dto.id,
    responseId,
    label: dto.label,
    model: detectModel(dto.label),
    isDiagram: isDiagramLabel(dto.label),
    shot: shotNumber(dto.label),
    imageUrl: file.url,
    mimeType: file.mimeType,
  };
}

function guessRole(name: string): AttachmentRole {
  return /location|room|interior|exterior|\bset\b|background|\bbg\b|plate|venue/i.test(name)
    ? "location"
    : "person";
}

interface Persisted {
  messages: ChatMessage[];
  items: GalleryItem[];
  conversationId: string | null;
  activeResponseId: string | null;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [live, setLive] = useState<LiveState>({
    responseId: null,
    status: "",
    phase: "",
    operations: [],
    pendingInputs: [],
  });
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const answerKeysRef = useRef(new Map<string, string>());
  const restoredRef = useRef(false);
  const activeResponseIdRef = useRef<string | null>(null);

  const system = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: uid(), role: "system", text }]);
  }, []);

  /* ---------- health ---------- */
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setHasKey(Boolean(j.hasKey)))
      .catch(() => setHasKey(null));
  }, []);

  /* ---------- persistence ---------- */
  useEffect(() => {
    if (!restoredRef.current) return;
    const data: Persisted = {
      messages,
      items,
      conversationId,
      activeResponseId: activeResponseIdRef.current,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / unavailable */
    }
  }, [messages, items, conversationId]);

  /* ---------- attachments ---------- */
  const uploadOne = useCallback(async (attId: string, file: File) => {
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        throw new Error(json.error || `Upload failed (${res.status}).`);
      }
      setAttachments((prev) =>
        prev.map((a) => (a.id === attId ? { ...a, upload: "ready", url: json.url } : a)),
      );
    } catch (err) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === attId
            ? { ...a, upload: "error", error: err instanceof Error ? err.message : "Upload failed." }
            : a,
        ),
      );
    }
  }, []);

  const addFiles = useCallback(
    (files: File[] | FileList) => {
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      for (const file of images) {
        const id = uid();
        const previewUrl = URL.createObjectURL(file);
        const att: Attachment = {
          id,
          kind: "image",
          name: file.name,
          previewUrl,
          role: guessRole(file.name),
          upload: "uploading",
        };
        setAttachments((prev) => [...prev, att]);
        const img = new Image();
        img.onload = () => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, width: img.naturalWidth, height: img.naturalHeight } : a,
            ),
          );
        };
        img.src = previewUrl;
        void uploadOne(id, file);
      }
      return images.length;
    },
    [uploadOne],
  );

  const addArtifactReference = useCallback((item: GalleryItem) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.artifactId === item.id)) return prev;
      return [
        ...prev,
        {
          id: uid(),
          kind: "artifact" as const,
          name: item.label || "Generated still",
          previewUrl: item.imageUrl,
          role: "reference" as const,
          upload: "ready" as const,
          artifactId: item.id,
        },
      ];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found?.kind === "image" && found.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const cycleRole = useCallback((id: string) => {
    const order: AttachmentRole[] = ["person", "location", "reference"];
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id && a.kind === "image"
          ? { ...a, role: order[(order.indexOf(a.role) + 1) % order.length] }
          : a,
      ),
    );
  }, []);

  /* ---------- snapshot application ---------- */
  const applySnapshot = useCallback((snap: SnapshotDto) => {
    conversationIdRef.current = snap.conversationId;
    setConversationId(snap.conversationId);
    activeResponseIdRef.current = TERMINAL.has(snap.status) ? null : snap.responseId;

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.responseId === snap.responseId);
      const next: ChatMessage = {
        id: idx >= 0 ? prev[idx].id : uid(),
        role: "agent",
        text: snap.outputText,
        responseId: snap.responseId,
        plans: snap.plans,
        notices: snap.notices,
        cost: snap.cost,
        done: TERMINAL.has(snap.status),
        error: snap.error,
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      }
      return [...prev, next];
    });

    setItems((prev) => {
      const byId = new Map(prev.map((i) => [i.id, i]));
      const merged = [...prev];
      for (const dto of snap.artifacts) {
        const item = galleryItemFrom(dto, snap.responseId);
        if (!item) continue;
        const existing = byId.get(item.id);
        if (existing) {
          const at = merged.findIndex((i) => i.id === item.id);
          merged[at] = { ...existing, ...item, label: item.label ?? existing.label };
        } else {
          byId.set(item.id, item);
          merged.push(item);
        }
      }
      return merged;
    });

    setLive({
      responseId: snap.responseId,
      status: snap.status,
      phase: snap.phase,
      operations: snap.operations,
      pendingInputs: snap.pendingInputs,
    });
  }, []);

  const consumeSse = useCallback(
    async (res: Response): Promise<SnapshotDto | null> => {
      if (!res.body) return null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let last: SnapshotDto | null = null;
      let streamError: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf("\n\n");
        while (sep !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (dataLine) {
            try {
              const event = JSON.parse(dataLine) as StreamEvent;
              if (event.type === "snapshot") {
                last = event.snapshot;
                applySnapshot(event.snapshot);
              } else if (event.type === "error") {
                streamError = event.message;
              }
            } catch {
              /* partial JSON across chunks is handled by buffering; ignore */
            }
          }
          sep = buffer.indexOf("\n\n");
        }
      }
      if (streamError) {
        if (last) {
          const rid = last.responseId;
          setMessages((prev) =>
            prev.map((m) => (m.responseId === rid ? { ...m, error: streamError, done: true } : m)),
          );
          activeResponseIdRef.current = null;
          return { ...last, status: "failed" };
        }
        throw new Error(streamError);
      }
      return last;
    },
    [applySnapshot],
  );

  const fetchStream = useCallback(
    async (url: string, body: unknown, signal: AbortSignal): Promise<Response> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || contentType.includes("application/json")) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const err = new Error(json.error || `Request failed (${res.status}).`) as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }
      return res;
    },
    [],
  );

  /** Consume a stream, then keep re-attaching via /resume until the run stops. */
  const runWithResume = useCallback(
    async (first: () => Promise<Response>, signal: AbortSignal) => {
      let last = await consumeSse(await first());
      let attempts = 0;
      while (last && !isStopped(last) && attempts < MAX_RESUMES && !signal.aborted) {
        attempts += 1;
        await new Promise((r) => setTimeout(r, 1200));
        if (signal.aborted) break;
        const res = await fetchStream(
          "/api/chat/resume",
          { responseId: last.responseId },
          signal,
        );
        last = (await consumeSse(res)) ?? last;
      }
      return last;
    },
    [consumeSse, fetchStream],
  );

  /* ---------- actions ---------- */
  const send = useCallback(
    async (text: string, aspectRatio: "16:9" | "21:9" | "4:3") => {
      if (busy) return;
      const ready = attachments.filter(
        (a) => a.kind === "image" && a.upload === "ready" && a.url,
      );
      const artifactAtts = attachments.filter(
        (a) => a.kind === "artifact" && a.artifactId,
      );
      const thumbnails: ChatThumb[] = [
        ...ready.map((a) => ({
          url: a.url as string,
          name: a.name,
          role: a.role,
          width: a.width,
          height: a.height,
        })),
        ...artifactAtts.map((a) => ({
          url: a.previewUrl,
          name: a.name,
          role: a.role,
          width: a.width,
          height: a.height,
        })),
      ];
      const payload = {
        text,
        images: ready.map((a) => ({ url: a.url as string, role: a.role, name: a.name })),
        artifactIds: artifactAtts.map((a) => a.artifactId as string),
        conversationId: conversationIdRef.current ?? undefined,
        firstTurn: !conversationIdRef.current,
        aspectRatio,
      };
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text, thumbnails },
      ]);
      for (const a of attachments) {
        if (a.kind === "image" && a.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(a.previewUrl);
        }
      }
      setAttachments([]);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await runWithResume(
          () => fetchStream("/api/chat", payload, controller.signal),
          controller.signal,
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          system(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [attachments, busy, fetchStream, runWithResume, system],
  );

  const answer = useCallback(
    async (pending: PendingInputDto, answerBody: AgentAnswerBody) => {
      const responseId = activeResponseIdRef.current;
      if (!responseId || busy) return;
      let key = answerKeysRef.current.get(pending.id);
      if (!key) {
        key = `ans-${pending.id}-${uid()}`;
        answerKeysRef.current.set(pending.id, key);
      }
      setLive((prev) => ({
        ...prev,
        pendingInputs: prev.pendingInputs.filter((p) => p.id !== pending.id),
      }));
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await runWithResume(
          () =>
            fetchStream(
              "/api/chat/answer",
              {
                responseId,
                inputRequestId: pending.id,
                answer: answerBody,
                idempotencyKey: key,
              },
              controller.signal,
            ),
          controller.signal,
        );
        answerKeysRef.current.delete(pending.id);
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 409 && !controller.signal.aborted) {
          // Stale input — refresh current state instead of failing loudly.
          try {
            await runWithResume(
              () =>
                fetchStream("/api/chat/resume", { responseId }, controller.signal),
              controller.signal,
            );
          } catch {
            /* surfaced below */
          }
        } else if (!controller.signal.aborted) {
          system(err instanceof Error ? err.message : "Could not submit that answer.");
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, fetchStream, runWithResume, system],
  );

  const reconnect = useCallback(async () => {
    const responseId = activeResponseIdRef.current;
    if (!responseId || busy) return;
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runWithResume(
        () => fetchStream("/api/chat/resume", { responseId }, controller.signal),
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        system(err instanceof Error ? err.message : "Reconnect failed.");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, fetchStream, runWithResume, system]);

  const cancel = useCallback(async () => {
    const responseId = activeResponseIdRef.current;
    abortRef.current?.abort();
    if (!responseId) return;
    try {
      const res = await fetch("/api/chat/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        snapshot?: SnapshotDto;
      };
      if (json.snapshot) applySnapshot(json.snapshot);
    } catch {
      /* best effort — local stream is already aborted */
    }
  }, [applySnapshot]);

  const newScene = useCallback(() => {
    if (activeResponseIdRef.current) void cancel();
    abortRef.current?.abort();
    conversationIdRef.current = null;
    activeResponseIdRef.current = null;
    answerKeysRef.current.clear();
    setConversationId(null);
    setMessages([]);
    setItems([]);
    setAttachments([]);
    setLive({ responseId: null, status: "", phase: "", operations: [], pendingInputs: [] });
    setBusy(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [cancel]);

  /* ---------- restore + auto-resume ---------- */
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    let data: Persisted | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw) as Persisted;
    } catch {
      data = null;
    }
    if (!data) return;
    setMessages(data.messages ?? []);
    setItems(data.items ?? []);
    conversationIdRef.current = data.conversationId ?? null;
    setConversationId(data.conversationId ?? null);
    if (data.activeResponseId) {
      activeResponseIdRef.current = data.activeResponseId;
      setLive((prev) => ({ ...prev, responseId: data.activeResponseId, phase: "running" }));
      // Re-attach to a run that kept executing server-side.
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      runWithResume(
        () =>
          fetchStream(
            "/api/chat/resume",
            { responseId: data.activeResponseId },
            controller.signal,
          ),
        controller.signal,
      )
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
          abortRef.current = null;
        });
    }
    // Run once on mount; callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    messages,
    items,
    attachments,
    live,
    busy,
    hasKey,
    conversationId,
    addFiles,
    addArtifactReference,
    removeAttachment,
    cycleRole,
    send,
    answer,
    cancel,
    reconnect,
    newScene,
  };
}
