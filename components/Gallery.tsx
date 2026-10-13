"use client";

import { useEffect, useMemo, useState } from "react";
import type { GalleryItem } from "@/hooks/useAgentChat";
import { COMPARE_MODELS, modelById } from "@/lib/models";
import type { OperationDto } from "@/lib/types";
import { CameraIcon, DownloadIcon, ExpandIcon, PlusIcon, XIcon } from "./icons";

const MODEL_ORDER: Record<string, number> = { banana: 0, gpt: 1, seedream: 2 };

async function downloadImage(item: GalleryItem) {
  const fallback = () => window.open(item.imageUrl, "_blank", "noopener");
  try {
    const res = await fetch(item.imageUrl);
    if (!res.ok) return fallback();
    const blob = await res.blob();
    const ext =
      item.mimeType?.split("/")[1]?.replace("jpeg", "jpg") ||
      item.imageUrl.split("?")[0].split(".").pop() ||
      "png";
    const name = (item.label || `coverage-${item.id.slice(0, 8)}`)
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "coverage-still"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    fallback();
  }
}

function ModelBadge({ item }: { item: GalleryItem }) {
  const model = modelById(item.model);
  if (item.isDiagram) {
    return (
      <span className="shrink-0 rounded bg-white/10 px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wide text-zinc-200">
        Overhead
      </span>
    );
  }
  if (!model) {
    return (
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-zinc-600" title="The agent did not name the model for this still">
        model?
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9.5px] font-medium uppercase tracking-wide text-zinc-300">
      <span className="h-2 w-2 rounded-full" style={{ background: model.dot }} />
      {model.short}
    </span>
  );
}

function ItemCard({
  item,
  fallbackLabel,
  onOpen,
  onUseAsReference,
}: {
  item: GalleryItem;
  fallbackLabel: string;
  onOpen: (item: GalleryItem) => void;
  onUseAsReference: (item: GalleryItem) => void;
}) {
  return (
    <figure className="group">
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
        <button type="button" onClick={() => onOpen(item)} className="block w-full cursor-zoom-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.label || fallbackLabel}
            loading="lazy"
            className="h-auto w-full"
            draggable={false}
          />
        </button>
        <div className="pointer-events-none absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onUseAsReference(item)}
            title="Attach to the next prompt as a reference"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-zinc-100 backdrop-blur transition hover:bg-black"
          >
            <PlusIcon width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => void downloadImage(item)}
            title="Download still"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-zinc-100 backdrop-blur transition hover:bg-black"
          >
            <DownloadIcon width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => onOpen(item)}
            title="View full size"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-zinc-100 backdrop-blur transition hover:bg-black"
          >
            <ExpandIcon width={14} height={14} />
          </button>
        </div>
        {item.shot != null && !item.isDiagram && (
          <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wide text-tungsten backdrop-blur">
            Shot {String(item.shot).padStart(2, "0")}
          </span>
        )}
      </div>
      <figcaption className="flex items-start justify-between gap-2 px-0.5 pt-1.5">
        <span className="min-w-0 text-[12px] leading-snug text-zinc-300">
          {item.label || fallbackLabel}
        </span>
        <ModelBadge item={item} />
      </figcaption>
    </figure>
  );
}

function Lightbox({
  item,
  onClose,
  onUseAsReference,
}: {
  item: GalleryItem;
  onClose: () => void;
  onUseAsReference: (item: GalleryItem) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt={item.label || "Generated still"}
        className="max-h-[84dvh] w-auto max-w-full rounded-lg border border-white/15 object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="max-w-[70vw] truncate text-[13px] text-zinc-200">
          {item.label || "Generated still"}
        </span>
        <ModelBadge item={item} />
        <button
          type="button"
          onClick={() => {
            onUseAsReference(item);
            onClose();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] text-zinc-100 transition hover:bg-white/20"
        >
          <PlusIcon width={13} height={13} /> Use as reference
        </button>
        <button
          type="button"
          onClick={() => void downloadImage(item)}
          className="flex items-center gap-1.5 rounded-lg bg-tungsten px-2.5 py-1.5 text-[12px] font-medium text-black transition hover:bg-[#f0b654]"
        >
          <DownloadIcon width={13} height={13} /> Download
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-100 transition hover:bg-white/20"
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
}

interface SetGroup {
  responseId: string;
  diagrams: GalleryItem[];
  shots: GalleryItem[];
}

export interface GalleryProps {
  items: GalleryItem[];
  setTitles: Record<string, string>;
  liveOperations: OperationDto[];
  liveResponseId: string | null;
  onUseAsReference: (item: GalleryItem) => void;
}

export default function Gallery({
  items,
  setTitles,
  liveOperations,
  liveResponseId,
  onUseAsReference,
}: GalleryProps) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  const sets = useMemo<SetGroup[]>(() => {
    const order: string[] = [];
    const byResponse = new Map<string, GalleryItem[]>();
    for (const item of items) {
      if (!byResponse.has(item.responseId)) {
        byResponse.set(item.responseId, []);
        order.push(item.responseId);
      }
      byResponse.get(item.responseId)?.push(item);
    }
    return order.map((responseId) => {
      const all = byResponse.get(responseId) ?? [];
      const diagrams = all.filter((i) => i.isDiagram);
      const shots = all
        .filter((i) => !i.isDiagram)
        .map((item, idx) => ({ item, idx }))
        .sort((a, b) => {
          const sa = a.item.shot ?? 999;
          const sb = b.item.shot ?? 999;
          if (sa !== sb) return sa - sb;
          const ma = a.item.model ? (MODEL_ORDER[a.item.model] ?? 3) : 3;
          const mb = b.item.model ? (MODEL_ORDER[b.item.model] ?? 3) : 3;
          if (ma !== mb) return ma - mb;
          return a.idx - b.idx;
        })
        .map((x) => x.item);
      return { responseId, diagrams, shots };
    });
  }, [items]);

  const itemIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const pendingOps = liveOperations.filter(
    (o) =>
      (o.status === "in_progress" || o.status === "queued") &&
      !o.artifactIds.some((id) => itemIds.has(id)),
  );

  const stillCount = items.filter((i) => !i.isDiagram).length;
  const diagramCount = items.length - stillCount;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-5">
      <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          Coverage board
        </h2>
        {items.length > 0 && (
          <span className="font-mono text-[11px] text-zinc-600">
            {stillCount} stills · {diagramCount} diagram{diagramCount === 1 ? "" : "s"}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-3.5 gap-y-1">
          {COMPARE_MODELS.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ background: m.dot }} />
              {m.name}
            </span>
          ))}
        </div>
      </header>

      {sets.length === 0 && pendingOps.length === 0 ? (
        <div className="flex min-h-[46dvh] flex-col items-center justify-center rounded-xl border border-dashed border-white/12 px-6 text-center">
          <CameraIcon width={30} height={30} className="text-zinc-600" />
          <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-zinc-500">
            Your coverage sets land here — overhead blocking diagrams first, then every
            wide, medium and close-up in triplicate, labelled by shot and model so you
            can pick winners side by side.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {sets.map((set, setIdx) => {
            const isLiveSet = set.responseId === liveResponseId;
            const title = setTitles[set.responseId];
            let stillIndex = 0;
            return (
              <section key={set.responseId}>
                <div className="mb-3 flex items-baseline gap-3 border-b border-white/10 pb-2">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-tungsten">
                    Set {String(setIdx + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate text-[13px] text-zinc-400">
                    {title || "Coverage run"}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                    {set.shots.length + set.diagrams.length} images
                  </span>
                </div>

                {set.diagrams.length > 0 && (
                  <>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      Overhead blocking · cameras C1…Cn match the shot numbers
                    </div>
                    <div className="mb-5 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                      {set.diagrams.map((item, i) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          fallbackLabel={`Blocking diagram ${i + 1}`}
                          onOpen={setSelected}
                          onUseAsReference={onUseAsReference}
                        />
                      ))}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3">
                  {set.shots.map((item) => {
                    stillIndex += 1;
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        fallbackLabel={`Still ${stillIndex}`}
                        onOpen={setSelected}
                        onUseAsReference={onUseAsReference}
                      />
                    );
                  })}
                  {isLiveSet &&
                    pendingOps.map((op) => (
                      <div key={op.id}>
                        <div className="shimmer flex aspect-video items-center justify-center rounded-lg border border-white/10 bg-zinc-900 px-4">
                          <span className="flex items-center gap-2 text-center font-mono text-[11px] text-zinc-500">
                            <CameraIcon width={14} height={14} className="shrink-0 text-tungsten/70" />
                            <span className="line-clamp-2">{op.name}</span>
                          </span>
                        </div>
                        <div className="px-0.5 pt-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                          generating…
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            );
          })}

          {sets.length === 0 && pendingOps.length > 0 && (
            <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[1100px]:grid-cols-3">
              {pendingOps.map((op) => (
                <div
                  key={op.id}
                  className="shimmer flex aspect-video items-center justify-center rounded-lg border border-white/10 bg-zinc-900 px-4"
                >
                  <span className="flex items-center gap-2 text-center font-mono text-[11px] text-zinc-500">
                    <CameraIcon width={14} height={14} className="shrink-0 text-tungsten/70" />
                    <span className="line-clamp-2">{op.name}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-8 text-[11px] leading-relaxed text-zinc-700">
          Stills are hosted on fal&apos;s CDN and image links can expire — download the
          keepers. Chat history is stored only in this browser.
        </p>
      )}

      {selected && (
        <Lightbox
          item={selected}
          onClose={() => setSelected(null)}
          onUseAsReference={onUseAsReference}
        />
      )}
    </div>
  );
}
