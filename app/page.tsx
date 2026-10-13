"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ChatPanel from "@/components/ChatPanel";
import Composer, { type AspectRatio } from "@/components/Composer";
import Gallery from "@/components/Gallery";
import { ApertureIcon } from "@/components/icons";
import { useAgentChat, type GalleryItem } from "@/hooks/useAgentChat";
import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_STORAGE_KEY,
  clampChatWidth,
  parseStoredChatWidth,
} from "@/lib/layout";

export default function Home() {
  const chat = useAgentChat();
  const [draft, setDraft] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const chatWidthRef = useRef(CHAT_WIDTH_DEFAULT);

  useEffect(() => {
    try {
      const stored = parseStoredChatWidth(
        localStorage.getItem(CHAT_WIDTH_STORAGE_KEY),
      );
      if (stored != null) {
        chatWidthRef.current = stored;
        setChatWidth(stored);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const persistChatWidth = (w: number) => {
    try {
      localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(w));
    } catch {
      /* storage unavailable */
    }
  };

  const applyChatWidth = (requested: number) => {
    const container = mainRef.current?.getBoundingClientRect().width ?? 1280;
    const next = clampChatWidth(requested, container);
    chatWidthRef.current = next;
    setChatWidth(next);
    return next;
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidthRef.current;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => {
      applyChatWidth(startW + (ev.clientX - startX));
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      persistChatWidth(chatWidthRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const nudgeResize = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    persistChatWidth(
      applyChatWidth(chatWidthRef.current + (e.key === "ArrowRight" ? 16 : -16)),
    );
  };

  const focusComposer = () => textareaRef.current?.focus();

  const setTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    let lastUserText = "";
    for (const m of chat.messages) {
      if (m.role === "user") lastUserText = m.text.trim();
      if (m.role === "agent" && m.responseId && !(m.responseId in titles)) {
        titles[m.responseId] =
          lastUserText.length > 90 ? `${lastUserText.slice(0, 90)}…` : lastUserText;
      }
    }
    return titles;
  }, [chat.messages]);

  const handleSend = () => {
    const text = draft;
    setDraft("");
    void chat.send(text, aspectRatio);
  };

  const handleUseAsReference = (item: GalleryItem) => {
    chat.addArtifactReference(item);
    focusComposer();
  };

  const handleNewScene = () => {
    if (
      chat.messages.length > 0 &&
      !window.confirm("Start a new scene? This clears the chat and the board in this browser.")
    ) {
      return;
    }
    chat.newScene();
    setDraft("");
    focusComposer();
  };

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  return (
    <main
      ref={mainRef}
      style={{ "--chat-width": `${chatWidth}px` } as CSSProperties}
      className="mx-auto flex h-dvh w-full max-w-[1600px] flex-col px-3 sm:px-5 md:flex-row lg:px-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length > 0) {
          e.preventDefault();
          chat.addFiles(files);
          focusComposer();
        }
      }}
    >
      {/* ---------- Left: chat ---------- */}
      <section
        className="relative flex h-[54dvh] w-full shrink-0 flex-col border-x border-b border-edge bg-panel md:h-auto md:w-[var(--chat-width)] md:max-w-[calc(100%-360px)] md:border-b-0 md:border-r-0"
        onDragEnter={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragCounter.current += 1;
          setDragging(true);
        }}
        onDragLeave={() => {
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragging(false);
          }
        }}
        onDragOver={(e) => {
          if (hasFiles(e)) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragCounter.current = 0;
          setDragging(false);
          if (e.dataTransfer?.files?.length) {
            chat.addFiles(e.dataTransfer.files);
            focusComposer();
          }
        }}
      >
        <header className="flex items-center gap-3 border-b border-edge px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tungsten text-black">
            <ApertureIcon width={20} height={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight text-zinc-50">
              Coverage
            </h1>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Dialogue-scene shot agent · fal Agent SDK
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewScene}
            className="ml-auto shrink-0 rounded-lg border border-white/12 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wide text-zinc-300 transition hover:bg-white/10"
          >
            New scene
          </button>
        </header>

        <ChatPanel
          messages={chat.messages}
          live={chat.live}
          busy={chat.busy}
          hasKey={chat.hasKey}
          onAnswer={(p, a) => void chat.answer(p, a)}
          onReconnect={() => void chat.reconnect()}
          onPickExample={(text) => {
            setDraft(text);
            focusComposer();
          }}
        />

        <Composer
          draft={draft}
          setDraft={setDraft}
          textareaRef={textareaRef}
          attachments={chat.attachments}
          onAddFiles={chat.addFiles}
          onRemoveAttachment={chat.removeAttachment}
          onCycleRole={chat.cycleRole}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          busy={chat.busy}
          waitingForInput={chat.live.pendingInputs.length > 0}
          isFollowUp={Boolean(chat.conversationId)}
          onSend={handleSend}
          onStop={() => void chat.cancel()}
        />

        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-tungsten/80 bg-black/70">
            <div className="px-6 text-center">
              <div className="text-[15px] font-medium text-zinc-50">
                Drop cast &amp; location images
              </div>
              <div className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
                They attach to your next prompt
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Resize divider ---------- */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat and board columns"
        title="Drag to resize the columns"
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={nudgeResize}
        className="group relative z-10 hidden w-2.5 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none md:flex"
      >
        <span
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
            resizing ? "bg-tungsten" : "bg-white/10 group-hover:bg-tungsten/60"
          }`}
        />
        <span
          className={`relative h-10 w-1 rounded-full transition-colors ${
            resizing ? "bg-tungsten" : "bg-white/20 group-hover:bg-tungsten/80"
          }`}
        />
      </div>

      {/* ---------- Right: coverage board ---------- */}
      <section className="scroll-slim min-h-0 flex-1 overflow-y-auto border-x border-edge bg-[#0a0a0b] md:border-l-0">
        <Gallery
          items={chat.items}
          setTitles={setTitles}
          liveOperations={chat.live.operations}
          liveResponseId={chat.live.responseId}
          onUseAsReference={handleUseAsReference}
        />
      </section>
    </main>
  );
}
