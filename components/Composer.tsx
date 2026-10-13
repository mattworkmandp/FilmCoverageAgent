"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Attachment } from "@/hooks/useAgentChat";
import {
  AlertIcon,
  PaperclipIcon,
  SendIcon,
  Spinner,
  StopIcon,
  XIcon,
} from "./icons";

export type AspectRatio = "16:9" | "21:9" | "4:3";

const ROLE_LABEL: Record<Attachment["role"], string> = {
  person: "Person",
  location: "Location",
  reference: "Ref",
};

function thumbStyle(att: Attachment): { height: number; width: number } {
  const h = 68;
  if (att.width && att.height) {
    const ratio = att.width / att.height;
    const width = Math.round(Math.min(120, Math.max(40, h * ratio)));
    return { height: h, width };
  }
  return { height: h, width: 68 };
}

function AttachmentThumb({
  att,
  onRemove,
  onCycleRole,
}: {
  att: Attachment;
  onRemove: (id: string) => void;
  onCycleRole: (id: string) => void;
}) {
  const size = thumbStyle(att);
  return (
    <div className="group relative shrink-0" title={att.error ?? att.name}>
      <div
        className={`relative overflow-hidden rounded-[10px] border bg-zinc-900 ${
          att.upload === "error" ? "border-red-500/60" : "border-white/15"
        }`}
        style={size}
      >
        {/* Native aspect ratio box: image fills it without cropping. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.previewUrl}
          alt={att.name}
          className="h-full w-full object-cover"
          draggable={false}
        />
        {att.upload === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <Spinner />
          </div>
        )}
        {att.upload === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-red-300">
            <AlertIcon width={18} height={18} />
          </div>
        )}
        <button
          type="button"
          onClick={() => att.kind === "image" && onCycleRole(att.id)}
          title={
            att.kind === "image"
              ? "Tap to change what this image is: Person → Location → Reference"
              : "A generated still used as reference"
          }
          className={`absolute bottom-1 left-1 rounded px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wide ${
            att.role === "location"
              ? "bg-tungsten text-black"
              : att.role === "person"
                ? "bg-sky-400 text-black"
                : "bg-zinc-700 text-zinc-100"
          } ${att.kind === "image" ? "cursor-pointer" : "cursor-default"}`}
        >
          {att.kind === "artifact" ? "Generated" : ROLE_LABEL[att.role]}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onRemove(att.id)}
        aria-label={`Remove ${att.name}`}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-zinc-800 text-zinc-200 shadow transition hover:bg-zinc-700"
      >
        <XIcon width={11} height={11} />
      </button>
    </div>
  );
}

export interface ComposerProps {
  draft: string;
  setDraft: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  attachments: Attachment[];
  onAddFiles: (files: File[] | FileList) => void;
  onRemoveAttachment: (id: string) => void;
  onCycleRole: (id: string) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (a: AspectRatio) => void;
  busy: boolean;
  waitingForInput: boolean;
  isFollowUp: boolean;
  onSend: () => void;
  onStop: () => void;
}

export default function Composer(props: ComposerProps) {
  const {
    draft,
    setDraft,
    textareaRef,
    attachments,
    onAddFiles,
    busy,
    waitingForInput,
    isFollowUp,
    onSend,
    onStop,
  } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploading = attachments.some((a) => a.upload === "uploading");
  const readyCount = attachments.filter((a) => a.upload === "ready").length;
  const canSend =
    !busy && !uploading && !waitingForInput && (draft.trim().length > 0 || readyCount > 0);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, textareaRef]);

  return (
    <div className="border-t border-edge bg-panel px-3 pb-3 pt-2">
      <div className="rounded-xl border border-white/12 bg-panel-2 focus-within:border-tungsten/50">
        {attachments.length > 0 && (
          <div className="scroll-slim flex gap-2.5 overflow-x-auto px-3 pb-1 pt-3">
            {attachments.map((att) => (
              <AttachmentThumb
                key={att.id}
                att={att}
                onRemove={props.onRemoveAttachment}
                onCycleRole={props.onCycleRole}
              />
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          rows={2}
          placeholder={
            waitingForInput
              ? "Answer the agent's question above to continue…"
              : isFollowUp
                ? "Revise the coverage — e.g. “Redo SHOT 04 tighter, and add a profile two-shot.”"
                : "Describe the dialogue scene — who is talking, the mood, any action. Drop in cast photos and one location photo first."
          }
          className="scroll-slim max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13.5px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-500"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach cast / location images (or drag & drop, or paste)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          >
            <PaperclipIcon width={17} height={17} />
          </button>
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            Frame
            <select
              value={props.aspectRatio}
              onChange={(e) => props.setAspectRatio(e.target.value as AspectRatio)}
              className="h-8 rounded-lg border border-white/10 bg-zinc-900 px-1.5 font-mono text-[11px] text-zinc-200 outline-none"
            >
              <option value="16:9">16:9</option>
              <option value="21:9">21:9</option>
              <option value="4:3">4:3</option>
            </select>
          </label>
          <span className="ml-auto hidden font-mono text-[10px] text-zinc-600 lg:block">
            {uploading ? "uploading…" : "Enter to send"}
          </span>
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop this run"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-red-500/90 px-3 text-[12.5px] font-medium text-white transition hover:bg-red-500"
            >
              <StopIcon width={12} height={12} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              title={isFollowUp ? "Send revision" : "Generate coverage set"}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-tungsten px-3 text-[12.5px] font-semibold text-black transition enabled:hover:bg-[#f0b654] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <SendIcon width={13} height={13} />
              {isFollowUp ? "Send" : "Generate coverage"}
            </button>
          )}
        </div>
      </div>
      <p className="px-1 pt-2 text-[11px] leading-relaxed text-zinc-600">
        Drag images anywhere onto this panel. Tap a thumbnail badge to mark it
        Person, Location or Ref. Each shot is generated with all three models.
      </p>
    </div>
  );
}
